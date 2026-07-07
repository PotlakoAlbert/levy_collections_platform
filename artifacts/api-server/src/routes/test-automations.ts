/**
 * TEST AUTOMATIONS ROUTE
 * 
 * This route provides test endpoints to verify that automations are working correctly.
 * These endpoints allow you to trigger automation events and check queue status.
 * 
 * IMPORTANT: This route is for testing only. In production, automations are triggered
 * by actual business events (creating matters, recording payments, etc.)
 * 
 * Usage:
 * 1. Start the server: `pnpm dev` in artifacts/api-server
 * 2. Test endpoints at: http://localhost:3000/api/test-automations/*
 * 3. Monitor logs to see automation execution
 * 4. Check admin endpoints for queue status
 */

import { Router, type IRouter } from "express";
import {
  db,
  debtorsTable,
  mattersTable,
  schemesTable,
  documentsTable,
  whatsappMessagesTable,
  eventLogsTable,
  communicationsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { emitEvent } from "../lib/hooks/event-hooks";
import { enqueueJob } from "../lib/jobs/dispatcher";
import {
  interestQueue,
  whatsappQueue,
  documentQueue,
  reminderQueue,
  reportQueue,
  autoAdvanceQueue,
  paymentQueue,
  aiQueue,
  getJobProcessingMode,
  getQueueCounts,
} from "../lib/queue";
import { logger } from "../lib/logger";
import { whatsappService } from "../lib/whatsapp/whatsapp.service";

const router: IRouter = Router();

/**
 * Test: Trigger DEBTOR_CREATED event
 * POST /api/test-automations/trigger-debtor-created
 * Body: { debtorId: "debtor-id" }
 * 
 * This simulates a new debtor being created and should:
 * - Send welcome WhatsApp message (if debtor has WhatsApp)
 * - Log onboarding event
 */
router.post("/test-automations/trigger-debtor-created", async (req, res): Promise<void> => {
  try {
    const { debtorId } = req.body;
    if (!debtorId) {
      res.status(400).json({ error: "debtorId is required" });
      return;
    }

    const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, debtorId));
    if (!debtor) {
      res.status(404).json({ error: "Debtor not found" });
      return;
    }

    logger.info(`[TEST] Manually triggering DEBTOR_CREATED for ${debtor.firstName} ${debtor.lastName}`);

    await emitEvent("DEBTOR_CREATED", {
      debtorId: debtor.id,
      fullName: `${debtor.firstName} ${debtor.lastName}`,
      email: debtor.email ?? null,
      phone: debtor.phone ?? null,
      whatsapp: debtor.whatsapp ?? null,
      status: debtor.status,
      createdById: "test-user",
    });

    res.json({
      success: true,
      message: `DEBTOR_CREATED event triggered for ${debtor.firstName} ${debtor.lastName}`,
      debtor: {
        id: debtor.id,
        name: `${debtor.firstName} ${debtor.lastName}`,
        whatsapp: debtor.whatsapp ?? null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Error triggering DEBTOR_CREATED");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Test: Trigger DEBTOR_STATUS_CHANGED event
 * POST /api/test-automations/trigger-debtor-status-changed
 * Body: { debtorId: "debtor-id", newStatus: "DEFAULTING" }
 * 
 * This simulates a debtor status change and should:
 * - Send urgent notification if status is DEFAULTING
 * - Enqueue payment reminders if status changes to DEFAULTING
 */
router.post("/test-automations/trigger-debtor-status-changed", async (req, res): Promise<void> => {
  try {
    const { debtorId, newStatus } = req.body;
    if (!debtorId || !newStatus) {
      res.status(400).json({ error: "debtorId and newStatus are required" });
      return;
    }

    const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, debtorId));
    if (!debtor) {
      res.status(404).json({ error: "Debtor not found" });
      return;
    }

    const oldStatus = debtor.status;
    logger.info(
      `[TEST] Manually triggering DEBTOR_STATUS_CHANGED for ${debtor.firstName} ${debtor.lastName}: ${oldStatus} → ${newStatus}`
    );

    await emitEvent("DEBTOR_STATUS_CHANGED", {
      debtorId: debtor.id,
      fullName: `${debtor.firstName} ${debtor.lastName}`,
      fromStatus: oldStatus,
      toStatus: newStatus,
      changedById: "test-user",
    });

    res.json({
      success: true,
      message: `DEBTOR_STATUS_CHANGED event triggered: ${oldStatus} → ${newStatus}`,
      debtor: {
        id: debtor.id,
        name: `${debtor.firstName} ${debtor.lastName}`,
        oldStatus,
        newStatus,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Error triggering DEBTOR_STATUS_CHANGED");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Test: Trigger MATTER_CREATED event
 * POST /api/test-automations/trigger-matter-created
 * Body: { matterId: "matter-id" }
 * 
 * This simulates a new matter being created and should:
 * - Generate LOD document
 * - Send LOD notice via WhatsApp
 * - Schedule T+7 reminder
 * - Check if matter is ready to advance stages
 */
router.post("/test-automations/trigger-matter-created", async (req, res): Promise<void> => {
  try {
    const { matterId } = req.body;
    if (!matterId) {
      res.status(400).json({ error: "matterId is required" });
      return;
    }

    const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, matterId));
    if (!matter) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    logger.info(`[TEST] Manually triggering MATTER_CREATED for matter ${matter.reference}`);

    await emitEvent("MATTER_CREATED", {
      matterId: matter.id,
      reference: matter.reference,
      debtorId: matter.debtorId,
      stage: matter.stage,
      createdById: "test-user",
    });

    res.json({
      success: true,
      message: `MATTER_CREATED event triggered for ${matter.reference}`,
      matter: {
        id: matter.id,
        reference: matter.reference,
        stage: matter.stage,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Error triggering MATTER_CREATED");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Test: Trigger PAYMENT_RECEIVED event
 * POST /api/test-automations/trigger-payment-received
 * Body: { paymentId: "payment-id" }
 * 
 * This simulates a payment being received and should:
 * - Allocate payment across capital/interest/costs
 * - Recalculate interest
 * - Check if matter should advance
 * - Send payment confirmation via WhatsApp
 */
router.post("/test-automations/trigger-payment-received", async (req, res): Promise<void> => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) {
      res.status(400).json({ error: "paymentId is required" });
      return;
    }

    logger.info(`[TEST] Manually triggering PAYMENT_RECEIVED for payment ${paymentId}`);

    await emitEvent("PAYMENT_RECEIVED", {
      paymentId,
      matterId: "test-matter-id",
      amount: 1000,
      createdById: "test-user",
    });

    res.json({
      success: true,
      message: `PAYMENT_RECEIVED event triggered for payment ${paymentId}`,
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Error triggering PAYMENT_RECEIVED");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Test: Trigger STAGE_CHANGED event
 * POST /api/test-automations/trigger-stage-changed
 * Body: { matterId: "matter-id", newStage: "S129" }
 * 
 * This simulates a stage change and should:
 * - Generate stage-specific documents
 * - Send stage-change notification via WhatsApp
 * - Check if matter should advance further
 */
router.post("/test-automations/trigger-stage-changed", async (req, res): Promise<void> => {
  try {
    const { matterId, newStage } = req.body;
    if (!matterId || !newStage) {
      res.status(400).json({ error: "matterId and newStage are required" });
      return;
    }

    const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, matterId));
    if (!matter) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const oldStage = matter.stage;
    logger.info(
      `[TEST] Manually triggering STAGE_CHANGED for matter ${matter.reference}: ${oldStage} → ${newStage}`
    );

    await emitEvent("STAGE_CHANGED", {
      matterId: matter.id,
      reference: matter.reference,
      fromStage: oldStage,
      toStage: newStage,
      changedById: "test-user",
    });

    res.json({
      success: true,
      message: `STAGE_CHANGED event triggered: ${oldStage} → ${newStage}`,
      matter: {
        id: matter.id,
        reference: matter.reference,
        oldStage,
        newStage,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Error triggering STAGE_CHANGED");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Test: Check all queue statuses
 * GET /api/test-automations/queue-status
 * 
 * Returns the current status of all 8 job queues
 */
router.get("/test-automations/queue-status", async (req, res): Promise<void> => {
  try {
    const queues = [
      { name: "interest", queue: interestQueue },
      { name: "whatsapp", queue: whatsappQueue },
      { name: "document", queue: documentQueue },
      { name: "reminder", queue: reminderQueue },
      { name: "report", queue: reportQueue },
      { name: "auto-advance", queue: autoAdvanceQueue },
      { name: "payment", queue: paymentQueue },
      { name: "ai", queue: aiQueue },
    ];

    const status = await Promise.all(
      queues.map(async (q) => {
        const counts = await q.queue.getJobCounts();
        return {
          name: q.name,
          ...counts,
        };
      })
    );

    res.json({
      timestamp: new Date().toISOString(),
      queues: status,
      summary: {
        totalPending: status.reduce((sum, q: any) => sum + (q.waiting || 0), 0),
        totalActive: status.reduce((sum, q: any) => sum + (q.active || 0), 0),
        totalCompleted: status.reduce((sum, q: any) => sum + (q.completed || 0), 0),
        totalFailed: status.reduce((sum, q: any) => sum + (q.failed || 0), 0),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Error getting queue status");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Test: Check jobs in a specific queue
 * GET /api/test-automations/queue/:queueName/jobs
 * 
 * Returns jobs in a specific queue (waiting, active, completed, failed)
 */
router.get("/test-automations/queue/:queueName/jobs", async (req, res): Promise<void> => {
  try {
    const { queueName } = req.params;

    const queueMap: Record<string, any> = {
      interest: interestQueue,
      whatsapp: whatsappQueue,
      document: documentQueue,
      reminder: reminderQueue,
      report: reportQueue,
      "auto-advance": autoAdvanceQueue,
      payment: paymentQueue,
      ai: aiQueue,
    };

    const queue = queueMap[queueName];
    if (!queue) {
      res.status(400).json({ error: `Unknown queue: ${queueName}` });
      return;
    }

    const waitingJobs = await queue.getWaiting(0, 10);
    const activeJobs = await queue.getActive(0, 10);
    const completedJobs = await queue.getCompleted(0, 10);
    const failedJobs = await queue.getFailed(0, 10);

    res.json({
      queueName,
      waiting: waitingJobs.map((j: any) => ({ id: j.id, name: j.name, data: j.data })),
      active: activeJobs.map((j: any) => ({ id: j.id, name: j.name, data: j.data })),
      completed: completedJobs.map((j: any) => ({ id: j.id, name: j.name, data: j.data })),
      failed: failedJobs.map((j: any) => ({ id: j.id, name: j.name, data: j.data, failedReason: j.failedReason })),
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Error getting queue jobs");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Test: Enqueue a manual job
 * POST /api/test-automations/enqueue-job
 * Body: { jobType: "whatsapp", data: { debtorPhone: "...", message: "..." } }
 * 
 * Allows manual enqueuing of jobs for testing
 */
router.post("/test-automations/enqueue-job", async (req, res): Promise<void> => {
  try {
    const { jobType, data } = req.body;

    if (!jobType || !data) {
      res.status(400).json({ error: "jobType and data are required" });
      return;
    }

    logger.info({ data }, `[TEST] Manually enqueuing job: ${jobType}`);

    const job = await enqueueJob(jobType, data);

    res.json({
      success: true,
      message: `Job enqueued successfully`,
      job: {
        id: job.id,
        type: jobType,
        data,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Error enqueuing job");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Test: Run full automation flow end-to-end
 * POST /api/test-automations/run-full-flow
 * Body: { matterId: "matter-id" } OR { debtorId: "debtor-id" }
 *
 * 1. Triggers MATTER_CREATED automation (LOD + WhatsApp + reminder schedule)
 * 2. Simulates debtor WhatsApp reply (bot response)
 * 3. Returns verification snapshot
 */
router.post("/test-automations/run-full-flow", async (req, res): Promise<void> => {
  try {
    let matterId = req.body.matterId as string | undefined;
    const debtorId = req.body.debtorId as string | undefined;

    if (!matterId && debtorId) {
      const [matter] = await db
        .select()
        .from(mattersTable)
        .where(eq(mattersTable.debtorId, debtorId))
        .limit(1);
      if (!matter) {
        res.status(404).json({ error: "No matter found for debtor" });
        return;
      }
      matterId = matter.id;
    }

    if (!matterId) {
      res.status(400).json({ error: "matterId or debtorId is required" });
      return;
    }

    const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, matterId));
    if (!matter) {
      res.status(404).json({ error: "Matter not found" });
      return;
    }

    const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, matter.debtorId));
    if (!debtor) {
      res.status(404).json({ error: "Debtor not found for matter" });
      return;
    }

    const phone = debtor.whatsapp || debtor.phone;
    if (!phone) {
      res.status(400).json({ error: "Debtor has no whatsapp or phone number for bot test" });
      return;
    }

    logger.info({ matterId, reference: matter.reference }, "[TEST] Running full automation flow");

    await emitEvent("MATTER_CREATED", {
      matterId: matter.id,
      reference: matter.reference,
      debtorId: matter.debtorId,
      stage: matter.stage,
      createdById: "test-automation",
    });

    // Allow BullMQ workers a moment to process; inline mode is already synchronous
    if (getJobProcessingMode() === "bullmq") {
      await new Promise((r) => setTimeout(r, 2000));
    }

    const mockPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "test-entry",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                messages: [
                  {
                    from: phone,
                    id: `test_flow_${Date.now()}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: { body: "I can pay R500 per month" },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    await whatsappService.handleIncomingWebhook(mockPayload as any);

    if (getJobProcessingMode() === "bullmq") {
      await new Promise((r) => setTimeout(r, 1500));
    }

    const docs = await db.select().from(documentsTable).where(eq(documentsTable.matterId, matterId));
    const waMessages = await db
      .select()
      .from(whatsappMessagesTable)
      .where(eq(whatsappMessagesTable.debtorId, matter.debtorId))
      .orderBy(desc(whatsappMessagesTable.createdAt))
      .limit(10);
    const activity = await db
      .select()
      .from(eventLogsTable)
      .where(eq(eventLogsTable.debtorId, matter.debtorId))
      .orderBy(desc(eventLogsTable.createdAt))
      .limit(15);
    const comms = await db
      .select()
      .from(communicationsTable)
      .where(eq(communicationsTable.matterId, matterId))
      .orderBy(desc(communicationsTable.createdAt))
      .limit(10);

    const queues = [
      { name: "document", queue: documentQueue },
      { name: "whatsapp", queue: whatsappQueue },
      { name: "reminder", queue: reminderQueue },
      { name: "auto-advance", queue: autoAdvanceQueue },
    ];
    const queueStatus = await Promise.all(
      queues.map(async (q) => ({ name: q.name, ...(await q.queue.getJobCounts()) }))
    );

    const lodGenerated = docs.some((d) => d.docType === "LOD");
    const outboundMessages = waMessages.filter((m) => m.direction === "OUTBOUND");
    const inboundMessages = waMessages.filter((m) => m.direction === "INBOUND");

    res.json({
      success: true,
      jobProcessingMode: getJobProcessingMode(),
      whatsappMode: process.env.WHATSAPP_MODE || "real",
      matter: { id: matter.id, reference: matter.reference },
      debtor: { id: debtor.id, name: `${debtor.firstName} ${debtor.lastName}`, phone },
      verification: {
        lodGenerated,
        documentCount: docs.length,
        inboundMessageCount: inboundMessages.length,
        outboundMessageCount: outboundMessages.length,
        activityLogCount: activity.length,
        communicationCount: comms.length,
        botResponded: outboundMessages.length > 0,
      },
      queues: queueStatus,
      recentActivity: activity.map((a) => ({
        eventType: a.eventType,
        message: (a.payload as any)?.message,
        status: a.status,
        createdAt: a.createdAt,
      })),
      recentWhatsApp: waMessages.map((m) => ({
        direction: m.direction,
        content: m.content?.slice(0, 80),
        status: m.status,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Full automation flow failed");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * Test: Get system automation status
 * GET /api/test-automations/system-status
 * 
 * Returns overall system automation health
 */
router.get("/test-automations/system-status", async (req, res): Promise<void> => {
  try {
    const debtorCount = await db.select().from(debtorsTable);
    const matterCount = await db.select().from(mattersTable);

    const queues = [
      { name: "interest", queue: interestQueue },
      { name: "whatsapp", queue: whatsappQueue },
      { name: "document", queue: documentQueue },
      { name: "reminder", queue: reminderQueue },
      { name: "report", queue: reportQueue },
      { name: "auto-advance", queue: autoAdvanceQueue },
      { name: "payment", queue: paymentQueue },
      { name: "ai", queue: aiQueue },
    ];

    const queueStatus = await Promise.all(
      queues.map(async (q) => getQueueCounts(q.queue))
    );

    const totalJobs = queueStatus.reduce(
      (acc, q) => {
        acc.pending += q.waiting;
        acc.active += q.active;
        acc.completed += q.completed;
        acc.failed += q.failed;
        return acc;
      },
      { pending: 0, active: 0, completed: 0, failed: 0 }
    );

    res.json({
      timestamp: new Date().toISOString(),
      jobProcessingMode: getJobProcessingMode(),
      whatsappMode: process.env.WHATSAPP_MODE || "real",
      aiProvider: process.env.AI_PROVIDER || "mock",
      system: {
        debtors: debtorCount.length,
        matters: matterCount.length,
        jobQueues: {
          ...totalJobs,
          total: totalJobs.pending + totalJobs.active + totalJobs.completed + totalJobs.failed,
        },
      },
      automationHealthCheck: {
        queuesRunning: queues.length,
        hasFailedJobs: totalJobs.failed > 0,
        failedJobCount: totalJobs.failed,
        isPending: totalJobs.pending > 0,
        pendingJobCount: totalJobs.pending,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "[TEST] Error getting system status");
    res.status(500).json({ error: String(error) });
  }
});

export default router;

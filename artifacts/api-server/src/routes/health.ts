import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { enqueueJob, enqueueInterestJob, enqueueWhatsAppJob } from "../lib/jobs/dispatcher";
import { getQueueHealth, getQueueNext, getJobProcessingMode } from "../lib/queue";
import { logger } from "../lib/logger";
import { aiService } from "../lib/ai/ai.service";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/automation-status", async (_req, res) => {
  try {
    const queues = await getQueueHealth();
    res.json({
      status: "ok",
      jobProcessingMode: getJobProcessingMode(),
      whatsappMode: process.env.WHATSAPP_MODE || "real",
      aiProvider: process.env.AI_PROVIDER || "mock",
      redis: process.env.REDIS_URL ? "configured" : "not configured",
      queues,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Error getting automation status");
    res.status(500).json({ status: "error", error: String(error) });
  }
});

router.get("/automation/queue-next", async (req, res) => {
  try {
    const { queueName } = req.query;
    const data = await getQueueNext(5, typeof queueName === "string" ? queueName : undefined);
    res.json({
      status: "ok",
      queueName: typeof queueName === "string" ? queueName : "all",
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "Error getting automation queue next");
    res.status(500).json({ status: "error", error: String(error) });
  }
});

// Phase 1: Test job queue functionality
router.post("/test-job", async (req, res) => {
  try {
    const job = await enqueueJob("interest", { matterId: "test-" + Date.now() });
    res.json({
      success: true,
      jobId: job.id,
      jobName: "name" in job && job.name ? job.name : "interest",
      status: "queued",
      message: "Job enqueued successfully. Check Redis dashboard to see job processing.",
    });
  } catch (error) {
    logger.error({ err: error }, "Error enqueueing test job");
    res.status(500).json({ error: String(error) });
  }
});

// Phase 1: Test interest job
router.post("/test-interest-job/:matterId", async (req, res) => {
  try {
    const job = await enqueueInterestJob(req.params.matterId);
    res.json({
      success: true,
      matterId: req.params.matterId,
      jobId: job.id,
      message: "Interest job queued for matter",
    });
  } catch (error) {
    logger.error({ err: error }, "Error enqueueing interest job");
    res.status(500).json({ error: String(error) });
  }
});

// Phase 1: Test WhatsApp job
router.post("/test-whatsapp-job", async (req, res) => {
  try {
    const { phone, matterId } = req.body;
    if (!phone || !matterId) {
      res.status(400).json({ error: "phone and matterId required" });
      return;
    }

    const job = await enqueueWhatsAppJob(phone, "Test message from job queue", matterId);
    res.json({
      success: true,
      phone,
      matterId,
      jobId: job.id,
      message: "WhatsApp job queued",
    });
  } catch (error) {
    logger.error({ err: error }, "Error enqueueing WhatsApp job");
    res.status(500).json({ error: String(error) });
  }
});

// Phase 1: Get queue health status
router.get("/queue-health", async (req, res) => {
  try {
    const health = await getQueueHealth();
    res.json({
      status: "ok",
      queues: health,
      timestamp: new Date().toISOString(),
      redis: process.env.REDIS_URL ? "configured" : "NOT CONFIGURED",
    });
  } catch (error) {
    logger.error({ err: error }, "Error getting queue health");
    res.status(500).json({
      status: "error",
      error: String(error),
      redis: process.env.REDIS_URL ? "configured" : "NOT CONFIGURED",
    });
  }
});

// ============================================================================
// Phase 3: AI Service Test Endpoints
// ============================================================================

// Compatibility endpoint from automation spec
router.post("/test-ai", async (req, res) => {
  try {
    const message = req.body?.message || "Can I pay monthly installments?";
    const result = await aiService.classifyDebtorIntent(message);
    res.json(result);
  } catch (error) {
    logger.error({ err: error }, "Error in /test-ai");
    res.status(500).json({ error: String(error) });
  }
});

// Phase 3: Test debtor intent classification
router.post("/test-ai-classify", async (req, res) => {
  try {
    const { message, matterId, debtorName } = req.body;
    if (!message) {
      res.status(400).json({ error: "message required" });
      return;
    }

    const result = await aiService.classifyDebtorIntent(message, {
      debtorName: debtorName || "Test Debtor",
    });

    res.json({
      success: true,
      method: "Intent Classification",
      input: { message, matterId, debtorName },
      result,
      message: "Debtor intent classified successfully",
    });
  } catch (error) {
    logger.error({ err: error }, "Error classifying debtor intent");
    res.status(500).json({ error: String(error) });
  }
});

// Phase 3: Test document drafting
router.post("/test-ai-draft", async (req, res) => {
  try {
    const {
      docType,
      matterId,
      debtorName,
      debtorAddress,
      outstandingBalance,
    } = req.body;

    if (!docType || !matterId || !debtorName || !outstandingBalance) {
      res.status(400).json({
        error: "docType, matterId, debtorName, outstandingBalance required",
      });
      return;
    }

    const result = await aiService.draftDocumentContent(docType, {
      matterId,
      debtorName,
      debtorAddress: debtorAddress || "Test Address",
      outstandingBalance: Number.parseFloat(outstandingBalance),
    });

    res.json({
      success: true,
      method: "Document Drafting",
      input: { docType, matterId, debtorName },
      result: {
        wordCount: result.wordCount,
        readabilityScore: result.readabilityScore,
        warnings: result.warnings,
        contentPreview: result.content.substring(0, 200) + "...",
      },
      fullContent: result.content,
      message: "Document drafted successfully",
    });
  } catch (error) {
    logger.error({ err: error }, "Error drafting document");
    res.status(500).json({ error: String(error) });
  }
});

// Phase 3: Test stage advancement recommendation
router.post("/test-ai-advance", async (req, res) => {
  try {
    const {
      matterId,
      currentStage,
      daysInStage,
      lastContactDaysAgo,
      responsiveness,
      outstandingBalance,
    } = req.body;

    if (!matterId || !currentStage) {
      res.status(400).json({ error: "matterId, currentStage required" });
      return;
    }

    const result = await aiService.recommendStageAdvancement({
      matterId,
      currentStage,
      daysInStage: daysInStage || 10,
      lastContactDaysAgo: lastContactDaysAgo || 5,
      responsiveness: responsiveness || "NONE",
      outstandingBalance: outstandingBalance || 5000,
      interestAccrual: 50,
      paymentHistory: [],
      previousOffers: [],
    });

    res.json({
      success: true,
      method: "Stage Advancement Recommendation",
      input: { matterId, currentStage, daysInStage, responsiveness },
      result,
      message: "Stage advancement recommendation generated",
    });
  } catch (error) {
    logger.error({ err: error }, "Error recommending stage advancement");
    res.status(500).json({ error: String(error) });
  }
});

// Phase 3: Test payment arrangement generation
router.post("/test-ai-payment", async (req, res) => {
  try {
    const { matterId, outstandingBalance, debtorOffer } = req.body;

    if (!matterId || !outstandingBalance) {
      res.status(400).json({
        error: "matterId, outstandingBalance required",
      });
      return;
    }

    const result = await aiService.generatePaymentArrangement({
      matterId,
      outstandingBalance: Number.parseFloat(outstandingBalance),
      monthlyInterest: 50,
      debtorOffer: debtorOffer ? Number.parseFloat(debtorOffer) : undefined,
    });

    res.json({
      success: true,
      method: "Payment Arrangement Generation",
      input: { matterId, outstandingBalance, debtorOffer },
      result,
      message: "Payment arrangement negotiated successfully",
    });
  } catch (error) {
    logger.error({ err: error }, "Error generating payment arrangement");
    res.status(500).json({ error: String(error) });
  }
});

// Phase 3: AI Service Info
router.get("/ai-info", async (_req, res) => {
  try {
    res.json({
      service: "AI Service",
      status: "ready",
      provider: process.env.AI_PROVIDER || "mock",
      capabilities: [
        "Intent classification",
        "Document drafting",
        "Stage advancement recommendation",
        "Payment arrangement negotiation",
      ],
      testEndpoints: [
        "POST /api/test-ai-classify",
        "POST /api/test-ai-draft",
        "POST /api/test-ai-advance",
        "POST /api/test-ai-payment",
      ],
      environment: {
        aiProvider: process.env.AI_PROVIDER || "mock",
        hasGeminiKey: !!process.env.GEMINI_API_KEY,
        hasDeepseekKey: !!process.env.DEEPSEEK_API_KEY,
      },
      message: "AI Service working. Use test endpoints to try different functions.",
    });
  } catch (error) {
    logger.error({ err: error }, "Error getting AI info");
    res.status(500).json({ error: String(error) });
  }
});

export default router;

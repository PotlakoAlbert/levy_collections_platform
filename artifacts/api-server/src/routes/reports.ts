import { Router, type IRouter } from "express";
import { db, mattersTable, debtorsTable, schemesTable, managingAgentsTable, paymentsTable, interestRatesTable, tasksTable, communicationsTable, stageHistoryTable } from "@workspace/db";
import { eq, count, sum, gte, lte, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { GetAgedDebtorsReportQueryParams, GetCollectionsByAgentQueryParams } from "@workspace/api-zod";
import { calculateInterest } from "../lib/interest";
import { enqueueJob } from "../lib/jobs/dispatcher";
import { logger } from "../lib/logger";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/reports/aged-debtors", async (req, res): Promise<void> => {
  const qp = GetAgedDebtorsReportQueryParams.safeParse(req.query);
  let matters = await db.select().from(mattersTable);

  if (qp.success) {
    if (qp.data.schemeId) matters = matters.filter((m) => m.schemeId === qp.data.schemeId);
  }

  const rows = await Promise.all(
    matters.map(async (matter) => {
      const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, matter.debtorId));
      const [scheme] = await db.select().from(schemesTable).where(eq(schemesTable.id, matter.schemeId));
      const agent = scheme ? (await db.select().from(managingAgentsTable).where(eq(managingAgentsTable.id, scheme.agentId)))[0] : null;

      if (qp.success && qp.data.agentId && agent?.id !== qp.data.agentId) return null;

      const capital = parseFloat(matter.capitalArrears);
      const costs = parseFloat(matter.legalCosts);
      const paid = parseFloat(matter.totalPaid);
      const fromDate = matter.interestFromDate ?? matter.lodDate ?? matter.createdAt;
      const { interest } = await calculateInterest(capital, fromDate);

      const totalOutstanding = capital + interest + costs - paid;
      const lodDate = matter.lodDate ?? matter.createdAt;
      const daysOld = Math.floor((Date.now() - lodDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        matterId: matter.id,
        reference: matter.reference,
        debtorName: debtor ? `${debtor.firstName} ${debtor.lastName}` : "Unknown",
        schemeName: scheme?.name ?? "Unknown",
        agentName: agent?.name ?? null,
        unit: matter.unit,
        stage: matter.stage,
        capitalArrears: capital,
        interest,
        legalCosts: costs,
        totalOutstanding,
        bucket0to30: daysOld <= 30 ? totalOutstanding : 0,
        bucket31to60: daysOld > 30 && daysOld <= 60 ? totalOutstanding : 0,
        bucket61to90: daysOld > 60 && daysOld <= 90 ? totalOutstanding : 0,
        bucket91to120: daysOld > 90 && daysOld <= 120 ? totalOutstanding : 0,
        bucket120plus: daysOld > 120 ? totalOutstanding : 0,
        lodDate: matter.lodDate?.toISOString() ?? null,
      };
    })
  );

  res.json(rows.filter(Boolean));
});

router.get("/reports/collections-by-agent", async (req, res): Promise<void> => {
  const qp = GetCollectionsByAgentQueryParams.safeParse(req.query);
  const agents = await db.select().from(managingAgentsTable);

  const rows = await Promise.all(
    agents.map(async (agent) => {
      const schemes = await db.select().from(schemesTable).where(eq(schemesTable.agentId, agent.id));
      const schemeIds = schemes.map((s) => s.id);

      let matters = await db.select().from(mattersTable);
      matters = matters.filter((m) => schemeIds.includes(m.schemeId));

      let totalCollected = 0;
      let totalCapital = 0;
      const mattersPerStage: Record<string, number> = {};

      for (const matter of matters) {
        totalCapital += parseFloat(matter.capitalArrears);
        totalCollected += parseFloat(matter.totalPaid);
        mattersPerStage[matter.stage] = (mattersPerStage[matter.stage] ?? 0) + 1;
      }

      const totalOutstanding = totalCapital - totalCollected;

      return {
        agentId: agent.id,
        agentName: agent.name,
        totalMatters: matters.length,
        totalCapital,
        totalCollected,
        totalOutstanding,
        mattersPerStage,
      };
    })
  );

  res.json(rows);
});

router.get("/reports/pipeline-summary", async (_req, res): Promise<void> => {
  const stages = ["LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];
  const matters = await db.select().from(mattersTable);

  const rows = stages.map((stage) => {
    const stageMatters = matters.filter((m) => m.stage === stage);
    const totalCapital = stageMatters.reduce((sum, m) => sum + parseFloat(m.capitalArrears), 0);
    const totalOutstanding = stageMatters.reduce(
      (sum, m) => sum + parseFloat(m.capitalArrears) + parseFloat(m.interest) + parseFloat(m.legalCosts) - parseFloat(m.totalPaid),
      0
    );
    return { stage, count: stageMatters.length, totalOutstanding, totalCapital };
  });

  res.json(rows);
});

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const matters = await db.select().from(mattersTable);
  const stages = ["LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];

  // Support optional filters: from, to (ISO dates) and clientId
  const from = req.query.from ? new Date(String(req.query.from)) : null;
  const to = req.query.to ? new Date(String(req.query.to)) : null;
  const clientId = req.query.clientId ? String(req.query.clientId) : null;

  // Optionally filter matters by clientId and (if date range supplied) by updatedAt
  let filteredMatters = matters;
  if (clientId) filteredMatters = filteredMatters.filter((m) => m.clientId === clientId);
  if (from && to) filteredMatters = filteredMatters.filter((m) => m.updatedAt >= from && m.updatedAt <= to);

  let totalCapital = 0, totalInterest = 0, totalLegalCosts = 0, totalCollected = 0;
  for (const m of filteredMatters) {
    totalCapital += parseFloat(m.capitalArrears);
    totalInterest += parseFloat(m.interest);
    totalLegalCosts += parseFloat(m.legalCosts);
    totalCollected += parseFloat(m.totalPaid);
  }

  // If a date range is provided, compute collected amount from payments in that range (more accurate for month filters)
  if (from && to) {
    const paymentsInRange = await db.select().from(paymentsTable).where(and(gte(paymentsTable.createdAt, from), lte(paymentsTable.createdAt, to)));
    totalCollected = paymentsInRange.reduce((s, p) => s + parseFloat(p.amount), 0);
  }

  const activeMatters = filteredMatters.filter((m) => m.status === "ACTIVE").length;
  const now = new Date();
  const allTasks = await db.select().from(tasksTable);
  const overdueTasksCount = allTasks.filter(
    (t) => !t.archivedAt && t.status !== "COMPLETED" && t.dueDate && t.dueDate < now,
  ).length;
  const totalOutstanding = totalCapital + totalInterest + totalLegalCosts - totalCollected;

  const mattersByStage = stages.map((stage) => {
    const stageMatters = filteredMatters.filter((m) => m.stage === stage);
    const stageCap = stageMatters.reduce((s, m) => s + parseFloat(m.capitalArrears), 0);
    const stageOut = stageMatters.reduce(
      (s, m) => s + parseFloat(m.capitalArrears) + parseFloat(m.interest) + parseFloat(m.legalCosts) - parseFloat(m.totalPaid),
      0
    );
    return { stage, count: stageMatters.length, totalOutstanding: stageOut, totalCapital: stageCap };
  });

  res.json({
    totalOutstanding,
    totalCapital,
    totalInterest,
    totalLegalCosts,
    totalCollected,
    activeMatters,
    overdueTasksCount,
    mattersByStage,
  });
});

router.get("/dashboard/overdue-tasks", async (_req, res): Promise<void> => {
  const now = new Date();
  const tasks = await db.select().from(tasksTable);
  const overdue = tasks
    .filter((t) => !t.archivedAt && t.status !== "COMPLETED" && t.dueDate && t.dueDate < now)
    .sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0;
      return a.dueDate.getTime() - b.dueDate.getTime();
    })
    .slice(0, 10);

  const enriched = await Promise.all(
    overdue.map(async (t) => {
      const [matter] = t.matterId ? await db.select().from(mattersTable).where(eq(mattersTable.id, t.matterId)) : [null];
      return {
        id: t.id,
        matterId: t.matterId,
        matterReference: matter?.reference ?? null,
        title: t.title,
        description: t.description ?? null,
        status: "OVERDUE",
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        assigneeId: t.assigneeId,
        assigneeName: null,
        isAutoGen: t.isAutoGen,
        completedAt: null,
        completionNote: null,
        createdAt: t.createdAt.toISOString(),
      };
    })
  );

  res.json(enriched);
});

router.get("/interest-rates", async (_req, res): Promise<void> => {
  const rates = await db.select().from(interestRatesTable).orderBy(interestRatesTable.effectiveFrom);
  res.json(
    rates.map((r) => ({
      id: r.id,
      rate: parseFloat(r.rate),
      effectiveFrom: r.effectiveFrom.toISOString(),
      effectiveTo: r.effectiveTo?.toISOString() ?? null,
      description: r.description ?? null,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post("/interest-rates", async (req, res): Promise<void> => {
  const { rate, effectiveFrom, effectiveTo, description } = req.body;
  if (!rate || !effectiveFrom) {
    res.status(400).json({ error: "rate and effectiveFrom are required" });
    return;
  }

  const [ir] = await db.insert(interestRatesTable).values({
    rate: String(rate),
    effectiveFrom: new Date(effectiveFrom),
    effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
    description: description ?? null,
  }).returning();

  res.status(201).json({
    id: ir.id,
    rate: parseFloat(ir.rate),
    effectiveFrom: ir.effectiveFrom.toISOString(),
    effectiveTo: ir.effectiveTo?.toISOString() ?? null,
    description: ir.description ?? null,
    createdAt: ir.createdAt.toISOString(),
  });
});

// ============================================================================
// Automation Reports (WEEKLY, MONTHLY, SUMMARY)
// ============================================================================

router.get("/reports/automation/weekly", async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Matters updated this week
    let mattersThisWeek = await db
      .select()
      .from(mattersTable)
      .where(and(gte(mattersTable.updatedAt, oneWeekAgo), lte(mattersTable.updatedAt, now)));

    const clientId = req.query.clientId ? String(req.query.clientId) : null;
    if (clientId) mattersThisWeek = mattersThisWeek.filter((m) => m.clientId === clientId);

    // Payments received this week
    let paymentsThisWeek = await db
      .select()
      .from(paymentsTable)
      .where(and(gte(paymentsTable.createdAt, oneWeekAgo), lte(paymentsTable.createdAt, now)));
    if (clientId) {
      const matterIds = mattersThisWeek.map((m) => m.id);
      paymentsThisWeek = paymentsThisWeek.filter((p) => matterIds.includes(p.matterId));
    }

    // Communications this week
    let communicationsThisWeek = await db
      .select()
      .from(communicationsTable)
      .where(and(gte(communicationsTable.createdAt, oneWeekAgo), lte(communicationsTable.createdAt, now)));
    if (clientId) {
      const matterIds = mattersThisWeek.map((m) => m.id);
      communicationsThisWeek = communicationsThisWeek.filter((c) => !c.matterId || matterIds.includes(c.matterId));
    }

    // Stage advancements this week
    let advancementsThisWeek = await db
      .select()
      .from(stageHistoryTable)
      .where(and(gte(stageHistoryTable.createdAt, oneWeekAgo), lte(stageHistoryTable.createdAt, now)));
    if (clientId) {
      const matterIds = mattersThisWeek.map((m) => m.id);
      advancementsThisWeek = advancementsThisWeek.filter((a) => matterIds.includes(a.matterId));
    }

    // Calculate metrics
    const totalPaymentsReceived = paymentsThisWeek.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const activeMatters = mattersThisWeek.filter((m) => m.status === "ACTIVE").length;
    const closedMatters = mattersThisWeek.filter((m) => m.status === "PAID_IN_FULL" || String(m.status).startsWith("CLOSED")).length;
    const whatsappMessages = communicationsThisWeek.filter((c) => c.channel === "WHATSAPP").length;

    res.json({
      reportType: "WEEKLY",
      period: {
        from: oneWeekAgo.toISOString(),
        to: now.toISOString(),
      },
      metrics: {
        mattersProcessed: mattersThisWeek.length,
        activeMatters,
        closedMatters,
        closureRate: mattersThisWeek.length > 0 ? ((closedMatters / mattersThisWeek.length) * 100).toFixed(2) + "%" : "0%",
        paymentsReceived: paymentsThisWeek.length,
        totalPaymentAmount: totalPaymentsReceived.toFixed(2),
        averagePaymentAmount: paymentsThisWeek.length > 0 ? (totalPaymentsReceived / paymentsThisWeek.length).toFixed(2) : "0",
        stageAdvancements: advancementsThisWeek.length,
        whatsappMessages,
        communicationsTotal: communicationsThisWeek.length,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "[REPORTS] Error generating weekly report");
    res.status(500).json({ error: "Failed to generate weekly report" });
  }
});

router.get("/reports/automation/monthly", async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Matters updated this month
    let mattersThisMonth = await db
      .select()
      .from(mattersTable)
      .where(and(gte(mattersTable.updatedAt, oneMonthAgo), lte(mattersTable.updatedAt, now)));
    const clientIdMonth = req.query.clientId ? String(req.query.clientId) : null;
    if (clientIdMonth) mattersThisMonth = mattersThisMonth.filter((m) => m.clientId === clientIdMonth);

    // Payments received this month
    let paymentsThisMonth = await db
      .select()
      .from(paymentsTable)
      .where(and(gte(paymentsTable.createdAt, oneMonthAgo), lte(paymentsTable.createdAt, now)));
    if (clientIdMonth) {
      const matterIds = mattersThisMonth.map((m) => m.id);
      paymentsThisMonth = paymentsThisMonth.filter((p) => matterIds.includes(p.matterId));
    }

    // Communications this month
    let communicationsThisMonth = await db
      .select()
      .from(communicationsTable)
      .where(and(gte(communicationsTable.createdAt, oneMonthAgo), lte(communicationsTable.createdAt, now)));
    if (clientIdMonth) {
      const matterIds = mattersThisMonth.map((m) => m.id);
      communicationsThisMonth = communicationsThisMonth.filter((c) => !c.matterId || matterIds.includes(c.matterId));
    }

    // Calculate metrics
    const totalPaymentsReceived = paymentsThisMonth.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const activeMatters = mattersThisMonth.filter((m) => m.status === "ACTIVE").length;
    const settledMatters = mattersThisMonth.filter((m) => m.status === "PAID_IN_FULL" || String(m.status).startsWith("CLOSED")).length;
    const whatsappMessages = communicationsThisMonth.filter((c) => c.channel === "WHATSAPP").length;

    // Calculate interest collected
    const interestCollected = mattersThisMonth.reduce((sum, m) => sum + parseFloat(m.interest), 0);

    res.json({
      reportType: "MONTHLY",
      period: {
        from: oneMonthAgo.toISOString(),
        to: now.toISOString(),
      },
      metrics: {
        mattersProcessed: mattersThisMonth.length,
        activeMatters,
        settledMatters,
        settlementRate: mattersThisMonth.length > 0 ? ((settledMatters / mattersThisMonth.length) * 100).toFixed(2) + "%" : "0%",
        paymentsReceived: paymentsThisMonth.length,
        totalPaymentAmount: totalPaymentsReceived.toFixed(2),
        averagePaymentAmount: paymentsThisMonth.length > 0 ? (totalPaymentsReceived / paymentsThisMonth.length).toFixed(2) : "0",
        interestCollected: interestCollected.toFixed(2),
        whatsappMessages,
        communicationsTotal: communicationsThisMonth.length,
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "[REPORTS] Error generating monthly report");
    res.status(500).json({ error: "Failed to generate monthly report" });
  }
});

router.get("/reports/automation/summary", async (req, res): Promise<void> => {
  try {
    const now = new Date();

    // Get all matters
    let allMatters = await db.select().from(mattersTable);
    const clientIdSummary = req.query.clientId ? String(req.query.clientId) : null;
    if (clientIdSummary) allMatters = allMatters.filter((m) => m.clientId === clientIdSummary);
    const activeMatters = allMatters.filter((m) => m.status === "ACTIVE");
    const settledMatters = allMatters.filter((m) => m.status === "PAID_IN_FULL" || String(m.status).startsWith("CLOSED"));

    // Get all payments
    let allPayments = await db.select().from(paymentsTable);
    if (clientIdSummary) {
      const matterIds = allMatters.map((m) => m.id);
      allPayments = allPayments.filter((p) => matterIds.includes(p.matterId));
    }
    const totalPaymentsReceived = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    // Get all communications
    let allCommunications = await db.select().from(communicationsTable);
    if (clientIdSummary) {
      const matterIds = allMatters.map((m) => m.id);
      allCommunications = allCommunications.filter((c) => !c.matterId || matterIds.includes(c.matterId));
    }
    const whatsappMessages = allCommunications.filter((c) => c.channel === "WHATSAPP").length;

    // Calculate outstanding amounts
    let totalOutstanding = 0;
    for (const matter of allMatters) {
      const capital = parseFloat(matter.capitalArrears);
      const interest = parseFloat(matter.interest);
      const costs = parseFloat(matter.legalCosts);
      const paid = parseFloat(matter.totalPaid);
      const outstanding = Math.max(0, capital + interest + costs - paid);
      totalOutstanding += outstanding;
    }

    res.json({
      reportType: "SUMMARY",
      systemStats: {
        totalMatters: allMatters.length,
        activeMatters: activeMatters.length,
        settledMatters: settledMatters.length,
        settlementRate: allMatters.length > 0 ? ((settledMatters.length / allMatters.length) * 100).toFixed(2) + "%" : "0%",
        totalOutstanding: totalOutstanding.toFixed(2),
        totalPaymentsReceived: totalPaymentsReceived.toFixed(2),
        whatsappMessages,
        totalCommunications: allCommunications.length,
      },
      breakdown: {
        byStage: allMatters.reduce(
          (acc, m) => {
            acc[m.stage] = (acc[m.stage] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
        byStatus: allMatters.reduce(
          (acc, m) => {
            acc[m.status] = (acc[m.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        ),
      },
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    logger.error({ err: error }, "[REPORTS] Error generating summary report");
    res.status(500).json({ error: "Failed to generate summary report" });
  }
});

router.post("/reports/automation/generate", async (req, res): Promise<void> => {
  try {
    const { reportType } = req.body;

    if (!reportType || !["WEEKLY", "MONTHLY", "SUMMARY"].includes(reportType)) {
      res.status(400).json({ error: "reportType must be WEEKLY, MONTHLY, or SUMMARY" });
      return;
    }

    const job = await enqueueJob("report", { reportType });

    res.json({
      success: true,
      message: `${reportType} report generation queued`,
      jobId: job.id,
      reportType,
    });
  } catch (error) {
    logger.error({ err: error }, "[REPORTS] Error enqueueing report");
    res.status(500).json({ error: "Failed to enqueue report" });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { db, mattersTable, debtorsTable, schemesTable, managingAgentsTable, paymentsTable, interestRatesTable, tasksTable } from "@workspace/db";
import { eq, count, sum } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { GetAgedDebtorsReportQueryParams, GetCollectionsByAgentQueryParams } from "@workspace/api-zod";
import { calculateInterest } from "../lib/interest";

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

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const matters = await db.select().from(mattersTable);
  const stages = ["LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];

  let totalCapital = 0, totalInterest = 0, totalLegalCosts = 0, totalCollected = 0;
  for (const m of matters) {
    totalCapital += parseFloat(m.capitalArrears);
    totalInterest += parseFloat(m.interest);
    totalLegalCosts += parseFloat(m.legalCosts);
    totalCollected += parseFloat(m.totalPaid);
  }

  const activeMatters = matters.filter((m) => m.status === "ACTIVE").length;
  const now = new Date();
  const allTasks = await db.select().from(tasksTable);
  const overdueTasksCount = allTasks.filter((t) => t.status !== "COMPLETED" && t.dueDate && t.dueDate < now).length;
  const totalOutstanding = totalCapital + totalInterest + totalLegalCosts - totalCollected;

  const mattersByStage = stages.map((stage) => {
    const stageMatters = matters.filter((m) => m.stage === stage);
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
    .filter((t) => t.status !== "COMPLETED" && t.dueDate && t.dueDate < now)
    .sort((a, b) => {
      if (!a.dueDate || !b.dueDate) return 0;
      return a.dueDate.getTime() - b.dueDate.getTime();
    })
    .slice(0, 10);

  const enriched = await Promise.all(
    overdue.map(async (t) => {
      const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, t.matterId));
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

export default router;

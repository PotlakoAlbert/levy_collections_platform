import { Router, type IRouter } from "express";
import { db, mattersTable, debtorsTable, schemesTable, managingAgentsTable, usersTable, stageHistoryTable, tasksTable, documentsTable, paymentsTable, promiseToPayTable, whatsappMessagesTable, matterAssigneesTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { generateMatterReference } from "../lib/reference";
import { createAutoTasks } from "../lib/tasks-automation";
import { calculateInterest } from "../lib/interest";
import { emitEvent } from "../lib/hooks/event-hooks";
import { enqueueJob } from "../lib/jobs/dispatcher";
import {
  getAutomationSettings,
  updateAutomationSettings,
  clearPendingBotDraft,
} from "../lib/automation-settings.service";
import { logJobQueued } from "../lib/activity-log.service";
import {
  CreateMatterBody,
  UpdateMatterBody,
  GetMatterParams,
  UpdateMatterParams,
  UpdateMatterStageParams,
  UpdateMatterStageBody,
  GetMatterHistoryParams,
  GetMatterFinancialsParams,
  ListMattersQueryParams,
  
} from "@workspace/api-zod";

const router: IRouter = Router();
router.use(authMiddleware);

function formatMatter(m: typeof mattersTable.$inferSelect) {
  return {
    ...m,
    capitalArrears: parseFloat(m.capitalArrears),
    interest: parseFloat(m.interest),
    legalCosts: parseFloat(m.legalCosts),
    totalPaid: parseFloat(m.totalPaid),
    interestFromDate: m.interestFromDate?.toISOString() ?? null,
    lodDate: m.lodDate?.toISOString() ?? null,
    s129Date: m.s129Date?.toISOString() ?? null,
    summonsDate: m.summonsDate?.toISOString() ?? null,
    judgmentDate: m.judgmentDate?.toISOString() ?? null,
    writDate: m.writDate?.toISOString() ?? null,
    saleDate: m.saleDate?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

router.get("/matters", async (req, res): Promise<void> => {
  const qp = ListMattersQueryParams.safeParse(req.query);
  let matters = await db.select().from(mattersTable).orderBy(mattersTable.updatedAt);

  if (qp.success) {
    if (qp.data.stage) matters = matters.filter((m) => m.stage === qp.data.stage);
    if (qp.data.status) matters = matters.filter((m) => m.status === qp.data.status);
    if (qp.data.schemeId) matters = matters.filter((m) => m.schemeId === qp.data.schemeId);
    if (qp.data.assignedToId) matters = matters.filter((m) => m.assignedToId === qp.data.assignedToId);
    if (qp.data.priority) matters = matters.filter((m) => m.priority === qp.data.priority);
  }

  // Apply search and agent filter during enrichment but compute total up-front
  const filteredCandidates = [] as typeof matters;
  for (const m of matters) {
    // We'll defer debtor/scheme lookup until we know the slice, but we still include all
    filteredCandidates.push(m);
  }

  const total = filteredCandidates.length;

  // Pagination
  const page = qp.success && (qp.data as any).page ? Math.max(1, Number((qp.data as any).page)) : 1;
  const limit = qp.success && (qp.data as any).limit ? Math.max(1, Number((qp.data as any).limit)) : undefined;
  const offset = limit ? (page - 1) * limit : 0;

  const pageSlice = typeof limit === "number" ? filteredCandidates.slice(offset, offset + limit) : filteredCandidates;

  // Enrich slice with debtor/scheme/agent names and apply search/agent filtering
  const enriched = await Promise.all(
    pageSlice.map(async (m) => {
      const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, m.debtorId));
      const [scheme] = await db.select().from(schemesTable).where(eq(schemesTable.id, m.schemeId));
      const agent = scheme ? (await db.select().from(managingAgentsTable).where(eq(managingAgentsTable.id, scheme.agentId)))[0] : null;
      const client = m.clientId ? (await db.select().from(managingAgentsTable).where(eq(managingAgentsTable.id, m.clientId)))[0] : null;
      const assignedUser = m.assignedToId ? (await db.select().from(usersTable).where(eq(usersTable.id, m.assignedToId)))[0] : null;

      // Filter by agentId if specified
      if (qp.success && qp.data.agentId && agent?.id !== qp.data.agentId) return null;

      const capital = parseFloat(m.capitalArrears);
      const interest = parseFloat(m.interest);
      const costs = parseFloat(m.legalCosts);
      const paid = parseFloat(m.totalPaid);

      // Filter by search if provided
      if (qp.success && qp.data.search) {
        const q = qp.data.search.toLowerCase();
        const debtorName = debtor ? `${debtor.firstName} ${debtor.lastName}`.toLowerCase() : "";
        if (!m.reference.toLowerCase().includes(q) && !debtorName.includes(q) && !(scheme?.name ?? "").toLowerCase().includes(q)) {
          return null;
        }
      }

      return {
        id: m.id,
        reference: m.reference,
        debtorName: debtor ? `${debtor.firstName} ${debtor.lastName}` : "Unknown",
        schemeName: scheme?.name ?? "Unknown",
        clientId: m.clientId ?? null,
        clientName: client?.name ?? null,
        agentName: agent?.name ?? null,
        unit: m.unit,
        stage: m.stage,
        priority: m.priority,
        status: m.status,
        capitalArrears: capital,
        interest,
        legalCosts: costs,
        totalPaid: paid,
        totalOutstanding: capital + interest + costs - paid,
        assignedToName: assignedUser?.name ?? null,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      };
    })
  );

  res.json({ matters: enriched.filter(Boolean), total });
});

router.post("/matters", async (req, res): Promise<void> => {
  const parsed = CreateMatterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const reference = await generateMatterReference();
  const userId = req.user!.id;

  const [matter] = await db.insert(mattersTable).values({
    reference,
    debtorId: parsed.data.debtorId,
    schemeId: parsed.data.schemeId,
    unit: parsed.data.unit,
    priority: parsed.data.priority,
    capitalArrears: String(parsed.data.capitalArrears),
    legalCosts: String(parsed.data.legalCosts ?? 0),
    interestFromDate: parsed.data.interestFromDate ? new Date(parsed.data.interestFromDate) : new Date(),
    assignedToId: parsed.data.assignedToId ?? null,
    createdById: userId,
    stage: "LOD",
    status: "ACTIVE",
  }).returning();

  // Stage history
  await db.insert(stageHistoryTable).values({
    matterId: matter.id,
    fromStage: null,
    toStage: "LOD",
    changedById: userId,
    notes: "Matter created",
  });

  // Set LOD date
  await db.update(mattersTable).set({ lodDate: new Date() }).where(eq(mattersTable.id, matter.id));

  // Create auto tasks
  const assigneeId = parsed.data.assignedToId ?? userId;
  await createAutoTasks(matter.id, "LOD", assigneeId);

  // Emit MATTER_CREATED event to trigger automation
  await emitEvent("MATTER_CREATED", {
    matterId: matter.id,
    reference: matter.reference,
    debtorId: matter.debtorId,
    stage: "LOD",
    createdById: userId,
  });

  res.status(201).json(formatMatter(matter));
});

router.get("/matters/:id", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, params.data.id));
  if (!matter) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }

  const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, matter.debtorId));
  const [scheme] = await db.select().from(schemesTable).where(eq(schemesTable.id, matter.schemeId));
  const agent = scheme ? (await db.select().from(managingAgentsTable).where(eq(managingAgentsTable.id, scheme.agentId)))[0] : null;
  const assignedUser = matter.assignedToId ? (await db.select().from(usersTable).where(eq(usersTable.id, matter.assignedToId)))[0] : null;
  const client = matter.clientId ? (await db.select().from(managingAgentsTable).where(eq(managingAgentsTable.id, matter.clientId)))[0] : null;

  const tasks = await db
    .select()
    .from(tasksTable)
    .where(and(eq(tasksTable.matterId, matter.id), isNull(tasksTable.archivedAt)));
  const documents = await db.select().from(documentsTable).where(eq(documentsTable.matterId, matter.id));
  const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.matterId, matter.id));
  const history = await db.select().from(stageHistoryTable).where(eq(stageHistoryTable.matterId, matter.id));
  const ptps = await db.select().from(promiseToPayTable).where(eq(promiseToPayTable.matterId, matter.id));
  const whatsappMessages = await db.select().from(whatsappMessagesTable).where(eq(whatsappMessagesTable.matterId, matter.id));

  // Enrich history with user names
  const enrichedHistory = await Promise.all(
    history.map(async (h) => {
      const [changedBy] = await db.select().from(usersTable).where(eq(usersTable.id, h.changedById));
      return {
        id: h.id,
        matterId: h.matterId,
        fromStage: h.fromStage ?? null,
        toStage: h.toStage,
        changedByName: changedBy?.name ?? "Unknown",
        notes: h.notes ?? null,
        createdAt: h.createdAt.toISOString(),
      };
    })
  );

  // Enrich tasks
  const enrichedTasks = await Promise.all(
    tasks.map(async (t) => {
      const [assignee] = await db.select().from(usersTable).where(eq(usersTable.id, t.assigneeId));
      return {
        id: t.id,
        matterId: t.matterId,
        matterReference: matter.reference,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        assigneeId: t.assigneeId,
        assigneeName: assignee?.name ?? null,
        isAutoGen: t.isAutoGen,
        completedAt: t.completedAt?.toISOString() ?? null,
        completionNote: t.completionNote ?? null,
        createdAt: t.createdAt.toISOString(),
      };
    })
  );

  // Enrich documents
  const enrichedDocuments = documents.map((d) => ({
    id: d.id,
    matterId: d.matterId,
    matterReference: matter.reference,
    docType: d.docType,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    generatedByName: null,
    sentVia: d.sentVia ?? null,
    sentAt: d.sentAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  // Enrich payments
  const enrichedPayments = await Promise.all(
    payments.map(async (p) => {
      const [receipted] = await db.select().from(usersTable).where(eq(usersTable.id, p.receiptedById));
      return {
        id: p.id,
        matterId: p.matterId,
        amount: parseFloat(p.amount),
        method: p.method,
        receivedDate: p.receivedDate.toISOString(),
        allocatedTo: p.allocatedTo ?? null,
        receiptedByName: receipted?.name ?? null,
        createdAt: p.createdAt.toISOString(),
      };
    })
  );

  res.json({
    id: matter.id,
    reference: matter.reference,
    debtor: debtor
      ? {
          id: debtor.id,
          firstName: debtor.firstName,
          lastName: debtor.lastName,
          fullName: `${debtor.firstName} ${debtor.lastName}`,
          idNumber: debtor.idNumber ?? null,
          companyName: debtor.companyName ?? null,
          email: debtor.email ?? null,
          phone: debtor.phone ?? null,
          whatsapp: debtor.whatsapp ?? null,
          physicalAddress: debtor.physicalAddress ?? null,
          status: debtor.status,
          createdAt: debtor.createdAt.toISOString(),
          matterCount: null,
        }
      : null,
    scheme: scheme
      ? {
          id: scheme.id,
          name: scheme.name,
          agentId: scheme.agentId,
          agentName: agent?.name ?? null,
          address: scheme.address ?? null,
          levyAmount: scheme.levyAmount ? parseFloat(scheme.levyAmount) : null,
          isActive: scheme.isActive,
          createdAt: scheme.createdAt.toISOString(),
          matterCount: null,
        }
      : null,
    unit: matter.unit,
    stage: matter.stage,
    priority: matter.priority,
    status: matter.status,
    capitalArrears: parseFloat(matter.capitalArrears),
    interest: parseFloat(matter.interest),
    legalCosts: parseFloat(matter.legalCosts),
    totalPaid: parseFloat(matter.totalPaid),
    interestFromDate: matter.interestFromDate?.toISOString() ?? null,
    lodDate: matter.lodDate?.toISOString() ?? null,
    s129Date: matter.s129Date?.toISOString() ?? null,
    summonsDate: matter.summonsDate?.toISOString() ?? null,
    judgmentDate: matter.judgmentDate?.toISOString() ?? null,
    writDate: matter.writDate?.toISOString() ?? null,
    saleDate: matter.saleDate?.toISOString() ?? null,
    assignedToId: matter.assignedToId ?? null,
    assignedToName: assignedUser?.name ?? null,
    client: client ? { id: client.id, name: client.name } : null,
    createdAt: matter.createdAt.toISOString(),
    updatedAt: matter.updatedAt.toISOString(),
    tasks: enrichedTasks,
    documents: enrichedDocuments,
    payments: enrichedPayments,
    history: enrichedHistory,
    ptp: (function() {
      const active = ptps.find((p) => p.isActive) ?? ptps[0] ?? null;
      if (!active) return null;
      return {
        id: active.id,
        firstPaymentDate: active.firstPaymentDate?.toISOString() ?? null,
        firstPaymentAmount: parseFloat(active.firstPaymentAmount),
        installmentDay: active.installmentDay,
        installmentAmount: parseFloat(active.installmentAmount),
        promiseDate: active.promiseDate?.toISOString() ?? null,
        isActive: active.isActive,
        createdById: active.createdById,
        createdAt: active.createdAt.toISOString(),
        updatedAt: active.updatedAt.toISOString(),
      };
    })(),
    whatsappMessages: whatsappMessages.map((m) => ({
      id: m.id,
      direction: m.direction,
      messageType: m.messageType,
      content: m.content,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});

// Promise To Pay endpoints for a matter
router.get("/matters/:id/ptp", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const ptps = await db.select().from(promiseToPayTable).where(eq(promiseToPayTable.matterId, params.data.id));
  const active = ptps.find((p) => p.isActive) ?? ptps[0] ?? null;
  if (!active) {
    res.json(null);
    return;
  }

  res.json({
    id: active.id,
    firstPaymentDate: active.firstPaymentDate?.toISOString() ?? null,
    firstPaymentAmount: parseFloat(active.firstPaymentAmount),
    installmentDay: active.installmentDay,
    installmentAmount: parseFloat(active.installmentAmount),
    promiseDate: active.promiseDate?.toISOString() ?? null,
    isActive: active.isActive,
    createdById: active.createdById,
    createdAt: active.createdAt.toISOString(),
    updatedAt: active.updatedAt.toISOString(),
  });
});

router.post("/matters/:id/ptp", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = req.body ?? {};
  const firstPaymentDate = body.firstPaymentDate ? new Date(body.firstPaymentDate) : null;
  const firstPaymentAmount = body.firstPaymentAmount != null ? String(body.firstPaymentAmount) : null;
  const installmentDay = body.installmentDay != null ? String(body.installmentDay) : null;
  const installmentAmount = body.installmentAmount != null ? String(body.installmentAmount) : null;
  const promiseDate = body.promiseDate ? new Date(body.promiseDate) : new Date();

  if (!firstPaymentDate || !firstPaymentAmount || !installmentDay || !installmentAmount) {
    res.status(400).json({ error: "Missing required PTP fields" });
    return;
  }

  const userId = req.user!.id;

  const [ptp] = await db.insert(promiseToPayTable).values({
    matterId: params.data.id,
    firstPaymentDate,
    firstPaymentAmount,
    installmentDay,
    installmentAmount,
    promiseDate,
    isActive: true,
    createdById: userId,
  }).returning();

  res.status(201).json({
    id: ptp.id,
    firstPaymentDate: ptp.firstPaymentDate?.toISOString() ?? null,
    firstPaymentAmount: parseFloat(ptp.firstPaymentAmount),
    installmentDay: ptp.installmentDay,
    installmentAmount: parseFloat(ptp.installmentAmount),
    promiseDate: ptp.promiseDate?.toISOString() ?? null,
    isActive: ptp.isActive,
    createdById: ptp.createdById,
    createdAt: ptp.createdAt.toISOString(),
    updatedAt: ptp.updatedAt.toISOString(),
  });
});

router.patch("/matters/:id/ptp/deactivate", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  // Deactivate the active PTP for the matter
  const ptps = await db.select().from(promiseToPayTable).where(eq(promiseToPayTable.matterId, params.data.id));
  const active = ptps.find((p) => p.isActive) ?? null;
  if (!active) {
    res.status(404).json({ error: "No active PTP found" });
    return;
  }

  const [updated] = await db.update(promiseToPayTable).set({ isActive: false }).where(eq(promiseToPayTable.id, active.id)).returning();
  res.json({ id: updated.id, isActive: updated.isActive });
});

// Generate tasks for a given milestone/stage on a matter
router.post("/matters/:id/generate-tasks", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = req.body ?? {};
  const stage = body.stage as string | undefined;
  const assigneeId = body.assigneeId ?? req.user!.id;
  if (!stage) {
    res.status(400).json({ error: "stage is required" });
    return;
  }

  // Create auto tasks for the stage
  await createAutoTasks(params.data.id, stage, assigneeId);

  // Return the tasks for the matter
  const matterTasks = await db.select().from(tasksTable).where(eq(tasksTable.matterId, params.data.id));
  const enriched = await Promise.all(
    matterTasks.map(async (t) => {
      const [assignee] = await db.select().from(usersTable).where(eq(usersTable.id, t.assigneeId));
      return {
        id: t.id,
        matterId: t.matterId,
        title: t.title,
        description: t.description ?? null,
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate?.toISOString() ?? null,
        assigneeId: t.assigneeId,
        assigneeName: assignee?.name ?? null,
        isAutoGen: t.isAutoGen,
        createdAt: t.createdAt.toISOString(),
      };
    })
  );

  res.status(201).json(enriched);
});

// -----------------------------
// Matter assignees (many-to-many)
// -----------------------------

router.get("/matters/:id/assignees", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const rows = await db.select().from(matterAssigneesTable).where(eq(matterAssigneesTable.matterId, params.data.id));
  const enriched = await Promise.all(
    rows.map(async (r) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId));
      return {
        id: r.id,
        matterId: r.matterId,
        userId: r.userId,
        role: r.role,
        assignedAt: r.assignedAt.toISOString(),
        assignedById: r.assignedById ?? null,
        unassignedAt: r.unassignedAt?.toISOString() ?? null,
        notes: r.notes ?? null,
        userName: user?.name ?? null,
        userEmail: user?.email ?? null,
      };
    })
  );

  res.json(enriched);
});

router.post("/matters/:id/assignees", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  // Parse body manually to avoid depending on generated types
  const body = req.body ?? {};
  const userIdToAssign = body.userId ? String(body.userId) : null;
  if (!userIdToAssign) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  // Ensure user exists
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userIdToAssign));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Prevent duplicate active assignment
  const existing = await db.select().from(matterAssigneesTable).where(eq(matterAssigneesTable.matterId, params.data.id));
  if (existing.some((e) => e.userId === userIdToAssign && !e.unassignedAt)) {
    res.status(400).json({ error: "User already assigned to this matter" });
    return;
  }

  const [assignee] = await db.insert(matterAssigneesTable).values({
    matterId: params.data.id,
    userId: userIdToAssign,
    role: body.role ?? "COLLECTOR",
    assignedById: req.user!.id,
    assignedAt: new Date(),
    notes: body.notes ?? null,
  }).returning();

  res.status(201).json({
    id: assignee.id,
    matterId: assignee.matterId,
    userId: assignee.userId,
    role: assignee.role,
    assignedAt: assignee.assignedAt?.toISOString() ?? null,
    assignedById: assignee.assignedById ?? null,
    unassignedAt: assignee.unassignedAt?.toISOString() ?? null,
    notes: assignee.notes ?? null,
    userName: user.name,
    userEmail: user.email,
  });
});

router.delete("/matters/:id/assignees/:assigneeId", async (req, res): Promise<void> => {
  const id = req.params.id;
  const assigneeId = req.params.assigneeId;
  if (!id || !assigneeId) {
    res.status(400).json({ error: "id and assigneeId are required" });
    return;
  }

  const [row] = await db.select().from(matterAssigneesTable).where(eq(matterAssigneesTable.id, assigneeId));
  if (!row) {
    res.status(404).json({ error: "Assignee not found" });
    return;
  }
  if (row.unassignedAt) {
    res.status(400).json({ error: "Assignee already unassigned" });
    return;
  }

  const [updated] = await db.update(matterAssigneesTable).set({ unassignedAt: new Date() }).where(eq(matterAssigneesTable.id, row.id)).returning();
  res.json({ id: updated.id, unassignedAt: updated.unassignedAt?.toISOString() ?? null });
});

router.patch("/matters/:id", async (req, res): Promise<void> => {
  const params = UpdateMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMatterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.unit != null) updates.unit = parsed.data.unit;
  if (parsed.data.priority != null) updates.priority = parsed.data.priority;
  if (parsed.data.status != null) updates.status = parsed.data.status;
  if (parsed.data.capitalArrears != null) updates.capitalArrears = String(parsed.data.capitalArrears);
  if (parsed.data.legalCosts != null) updates.legalCosts = String(parsed.data.legalCosts);
  if ("interestFromDate" in parsed.data) updates.interestFromDate = parsed.data.interestFromDate ? new Date(parsed.data.interestFromDate) : null;
  if ("assignedToId" in parsed.data) updates.assignedToId = parsed.data.assignedToId;
  if ("lodDate" in parsed.data) updates.lodDate = parsed.data.lodDate ? new Date(parsed.data.lodDate) : null;
  if ("s129Date" in parsed.data) updates.s129Date = parsed.data.s129Date ? new Date(parsed.data.s129Date) : null;
  if ("summonsDate" in parsed.data) updates.summonsDate = parsed.data.summonsDate ? new Date(parsed.data.summonsDate) : null;
  if ("judgmentDate" in parsed.data) updates.judgmentDate = parsed.data.judgmentDate ? new Date(parsed.data.judgmentDate) : null;
  if ("writDate" in parsed.data) updates.writDate = parsed.data.writDate ? new Date(parsed.data.writDate) : null;
  if ("saleDate" in parsed.data) updates.saleDate = parsed.data.saleDate ? new Date(parsed.data.saleDate) : null;

  const [matter] = await db.update(mattersTable).set(updates).where(eq(mattersTable.id, params.data.id)).returning();
  if (!matter) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }

  res.json(formatMatter(matter));
});

router.patch("/matters/:id/stage", async (req, res): Promise<void> => {
  const params = UpdateMatterStageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateMatterStageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const VALID_STAGES = ["LOD", "S129", "SUMMONS", "JUDGMENT", "WRIT", "RULE46", "SALE", "CLOSED"];
  if (!VALID_STAGES.includes(parsed.data.stage)) {
    res.status(400).json({ error: "Invalid stage" });
    return;
  }

  const [existing] = await db.select().from(mattersTable).where(eq(mattersTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }

  const userId = req.user!.id;
  const stageDate = new Date();
  const updates: Record<string, unknown> = { stage: parsed.data.stage };

  // Set stage date fields
  if (parsed.data.stage === "S129") updates.s129Date = stageDate;
  if (parsed.data.stage === "SUMMONS") updates.summonsDate = stageDate;
  if (parsed.data.stage === "JUDGMENT") updates.judgmentDate = stageDate;
  if (parsed.data.stage === "WRIT") updates.writDate = stageDate;
  if (parsed.data.stage === "SALE") updates.saleDate = stageDate;

  // If advancing to CLOSED, determine closed status (settled vs written off)
  if (parsed.data.stage === "CLOSED") {
    const capital = parseFloat(existing.capitalArrears as any) || 0;
    const costs = parseFloat(existing.legalCosts as any) || 0;
    const interest = parseFloat(existing.interest as any) || 0;
    const paid = parseFloat(existing.totalPaid as any) || 0;
    const outstanding = capital + costs + interest - paid;

    if (outstanding <= 0) {
      updates.status = "CLOSED_SETTLED";
    } else {
      updates.status = "CLOSED_WRITTEN_OFF";
    }
  }

  const [matter] = await db.update(mattersTable).set(updates).where(eq(mattersTable.id, params.data.id)).returning();

  // Record stage history
  await db.insert(stageHistoryTable).values({
    matterId: matter.id,
    fromStage: existing.stage,
    toStage: parsed.data.stage,
    changedById: userId,
    notes: parsed.data.notes ?? null,
  });

  // Create auto tasks for new stage
  const assigneeId = matter.assignedToId ?? userId;
  await createAutoTasks(matter.id, parsed.data.stage, assigneeId);

  // Emit STAGE_CHANGED event to trigger automation
  await emitEvent("STAGE_CHANGED", {
    matterId: matter.id,
    reference: matter.reference,
    fromStage: existing.stage,
    toStage: parsed.data.stage,
    changedById: userId,
  });

  res.json(formatMatter(matter));
});

router.get("/matters/:id/history", async (req, res): Promise<void> => {
  const params = GetMatterHistoryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const history = await db.select().from(stageHistoryTable).where(eq(stageHistoryTable.matterId, params.data.id));
  const enriched = await Promise.all(
    history.map(async (h) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, h.changedById));
      return {
        id: h.id,
        matterId: h.matterId,
        fromStage: h.fromStage ?? null,
        toStage: h.toStage,
        changedByName: user?.name ?? "Unknown",
        notes: h.notes ?? null,
        createdAt: h.createdAt.toISOString(),
      };
    })
  );

  res.json(enriched);
});

router.get("/matters/:id/financials", async (req, res): Promise<void> => {
  const params = GetMatterFinancialsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, params.data.id));
  if (!matter) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }

  const capital = parseFloat(matter.capitalArrears);
  const costs = parseFloat(matter.legalCosts);
  const paid = parseFloat(matter.totalPaid);
  const fromDate = matter.interestFromDate ?? matter.lodDate ?? matter.createdAt;

  const { interest: interestAccrued, rate, days, perDay } = await calculateInterest(capital, fromDate);

  const totalOutstanding = capital + interestAccrued + costs - paid;

  res.json({
    matterId: matter.id,
    capitalArrears: capital,
    interestAccrued,
    interestRate: rate,
    interestFromDate: fromDate.toISOString(),
    interestDays: days,
    interestPerDay: perDay,
    legalCosts: costs,
    totalPaid: paid,
    totalOutstanding,
    runningBalance: totalOutstanding,
  });
});

// Send WhatsApp message
router.post("/matters/:id/whatsapp/send", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = req.body ?? {};
  const { content, recipientPhone } = body;

  if (!content || !recipientPhone) {
    res.status(400).json({ error: "content and recipientPhone are required" });
    return;
  }

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, params.data.id));
  if (!matter) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }

  // Create message record
  const [message] = await db.insert(whatsappMessagesTable).values({
    matterId: matter.id,
    debtorId: matter.debtorId,
    direction: "OUTBOUND",
    messageType: "text",
    content: String(content),
    status: "QUEUED",
    createdById: req.user!.id,
  }).returning();

  await enqueueJob("whatsapp", {
    debtorPhone: String(recipientPhone),
    message: String(content),
    matterId: matter.id,
    debtorId: matter.debtorId,
    whatsappMessageId: message.id,
  });

  const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, matter.debtorId));
  if (debtor) {
    await logJobQueued(matter.debtorId, matter.id, "WhatsApp message", "whatsapp");
  }

  res.status(201).json({
    id: message.id,
    matterId: message.matterId,
    debtorId: message.debtorId,
    direction: message.direction,
    content: message.content,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
  });
});

// Get WhatsApp messages for a matter
router.get("/matters/:id/whatsapp/messages", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const messages = await db.select().from(whatsappMessagesTable).where(eq(whatsappMessagesTable.matterId, params.data.id)).orderBy(whatsappMessagesTable.createdAt);

  const formatted = messages.map((m) => ({
    id: m.id,
    direction: m.direction,
    messageType: m.messageType,
    content: m.content,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  }));

  res.json(formatted);
});

// Automation settings for a matter (LOD automation, bot auto-reply)
router.get("/matters/:id/automation", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, params.data.id));
  if (!matter) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }

  const settings = await getAutomationSettings(matter.id);
  res.json({ matterId: matter.id, ...settings });
});

router.patch("/matters/:id/automation", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, params.data.id));
  if (!matter) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }

  const body = req.body ?? {};
  const updates: { automationEnabled?: boolean; botAutoReplyEnabled?: boolean } = {};
  if (typeof body.automationEnabled === "boolean") updates.automationEnabled = body.automationEnabled;
  if (typeof body.botAutoReplyEnabled === "boolean") updates.botAutoReplyEnabled = body.botAutoReplyEnabled;

  const settings = await updateAutomationSettings(matter.id, matter.debtorId, updates);
  res.json({ matterId: matter.id, ...settings });
});

// Approve a pending bot draft and send via WhatsApp queue
router.post("/matters/:id/bot-draft/approve", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, params.data.id));
  if (!matter) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }

  const settings = await getAutomationSettings(matter.id);
  if (!settings.pendingDraft) {
    res.status(404).json({ error: "No pending bot draft" });
    return;
  }

  const draft = settings.pendingDraft;
  const messageText = String(req.body?.message ?? draft.messageText);

  const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, matter.debtorId));
  const debtorName = debtor ? `${debtor.firstName} ${debtor.lastName}` : "debtor";

  const [waRow] = await db.insert(whatsappMessagesTable).values({
    matterId: matter.id,
    debtorId: matter.debtorId,
    direction: "OUTBOUND",
    messageType: "text",
    content: messageText,
    status: "QUEUED",
    createdById: req.user!.id,
  }).returning();

  await logJobQueued(matter.debtorId, matter.id, "Approved bot reply", "whatsapp");
  await enqueueJob("whatsapp", {
    debtorPhone: draft.debtorPhone,
    message: messageText,
    matterId: matter.id,
    debtorId: matter.debtorId,
    debtorName,
    whatsappMessageId: waRow?.id,
    activityContext: "BOT_REPLY",
  });

  await clearPendingBotDraft(matter.id, matter.debtorId);

  res.json({ success: true, messageId: waRow?.id });
});

router.post("/matters/:id/bot-draft/reject", async (req, res): Promise<void> => {
  const params = GetMatterParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, params.data.id));
  if (!matter) {
    res.status(404).json({ error: "Matter not found" });
    return;
  }

  await clearPendingBotDraft(matter.id, matter.debtorId);
  res.json({ success: true });
});

export default router;

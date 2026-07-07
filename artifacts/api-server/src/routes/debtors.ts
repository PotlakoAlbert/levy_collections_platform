import { Router, type IRouter } from "express";
import { db, debtorsTable, mattersTable, documentsTable, communicationsTable, whatsappMessagesTable, eventLogsTable } from "@workspace/db";
import { eq, count, or, ilike, and, inArray, desc } from "drizzle-orm";
import { authMiddleware, requireRole } from "../lib/auth";
import { emitEvent } from "../lib/hooks/event-hooks";
import { CreateDebtorBody, UpdateDebtorBody, GetDebtorParams, UpdateDebtorParams, ListDebtorsQueryParams, GetDebtorMattersParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.use(authMiddleware);

async function formatDebtor(debtor: typeof debtorsTable.$inferSelect, includeCount = true) {
  let matterCount: number | null = null;
  if (includeCount) {
    const [row] = await db.select({ count: count() }).from(mattersTable).where(eq(mattersTable.debtorId, debtor.id));
    matterCount = row?.count ?? 0;
  }

  return {
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
    matterCount,
  };
}

router.get("/debtors", async (req, res): Promise<void> => {
  const queryParams = ListDebtorsQueryParams.safeParse(req.query);

  // Build WHERE expression for DB-level filtering
  let whereExpr: any = undefined;
  if (queryParams.success) {
    const clauses: any[] = [];
    if (queryParams.data.status) {
      clauses.push(eq(debtorsTable.status, queryParams.data.status));
    }
    if (queryParams.data.search) {
      const q = `%${queryParams.data.search}%`;
      clauses.push(
        or(
          ilike(debtorsTable.firstName, q),
          ilike(debtorsTable.lastName, q),
          ilike(debtorsTable.idNumber, q),
          ilike(debtorsTable.companyName, q),
          ilike(debtorsTable.email, q),
        ),
      );
    }

    if (clauses.length === 1) whereExpr = clauses[0];
    else if (clauses.length > 1) whereExpr = and(...clauses);
  }

  // Compute total matching count
  const totalRow = whereExpr
    ? await db.select({ count: count() }).from(debtorsTable).where(whereExpr)
    : await db.select({ count: count() }).from(debtorsTable);
  const total = Number(totalRow?.[0]?.count ?? 0);

  // Pagination
  const page = queryParams.success && (queryParams.data as any).page ? Math.max(1, Number((queryParams.data as any).page)) : 1;
  const limit = queryParams.success && (queryParams.data as any).limit ? Math.max(1, Number((queryParams.data as any).limit)) : undefined;
  const offset = limit ? (page - 1) * limit : undefined;

  // Query rows with optional pagination
  let rowsQuery: any = db.select().from(debtorsTable).orderBy(debtorsTable.lastName);
  if (whereExpr) rowsQuery = rowsQuery.where(whereExpr);
  if (limit) rowsQuery = rowsQuery.limit(limit as any);
  if (offset) rowsQuery = rowsQuery.offset(offset as any);

  const debtors = await rowsQuery;

  const formatted = await Promise.all(debtors.map((d: any) => formatDebtor(d)));
  res.json({ debtors: formatted, total });
});

router.post("/debtors", async (req, res): Promise<void> => {
  const parsed = CreateDebtorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [debtor] = await db.insert(debtorsTable).values(parsed.data).returning();
  
  // Emit DEBTOR_CREATED event to trigger automation
  await emitEvent("DEBTOR_CREATED", {
    debtorId: debtor.id,
    fullName: `${debtor.firstName} ${debtor.lastName}`,
    email: debtor.email ?? null,
    phone: debtor.phone ?? null,
    whatsapp: debtor.whatsapp ?? null,
    status: debtor.status,
    createdById: req.user!.id,
  });
  
  res.status(201).json(await formatDebtor(debtor, false));
});

router.get("/debtors/:id", async (req, res): Promise<void> => {
  const params = GetDebtorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, params.data.id));
  if (!debtor) {
    res.status(404).json({ error: "Debtor not found" });
    return;
  }

  // Base formatted debtor info
  const formatted = await formatDebtor(debtor);

  // Fetch matters for this debtor to link documents/communications
  const matters = await db.select().from(mattersTable).where(eq(mattersTable.debtorId, debtor.id));
  const matterIds = (matters || []).map((m: any) => m.id).filter(Boolean);

  // Documents related to debtor matters
  let docs: any[] = [];
  if (matterIds.length > 0) {
    docs = await db.select().from(documentsTable).where(inArray(documentsTable.matterId, matterIds)).orderBy(documentsTable.createdAt);
  }

  // WhatsApp messages either linked directly to debtor or to any of their matters
  let waMessages: any[] = [];
  if (matterIds.length > 0) {
    waMessages = await db.select().from(whatsappMessagesTable).where(or(eq(whatsappMessagesTable.debtorId, debtor.id), inArray(whatsappMessagesTable.matterId, matterIds))).orderBy(whatsappMessagesTable.createdAt);
  } else {
    waMessages = await db.select().from(whatsappMessagesTable).where(eq(whatsappMessagesTable.debtorId, debtor.id)).orderBy(whatsappMessagesTable.createdAt);
  }

  // Communications: those tied to matters OR addressed to debtor contact details
  const commClauses: any[] = [];
  if (matterIds.length > 0) commClauses.push(inArray(communicationsTable.matterId, matterIds));
  if (debtor.whatsapp) commClauses.push(eq(communicationsTable.to, debtor.whatsapp));
  if (debtor.email) commClauses.push(eq(communicationsTable.to, debtor.email));
  if (debtor.phone) commClauses.push(eq(communicationsTable.to, debtor.phone));

  let comms: any[] = [];
  if (commClauses.length > 0) {
    comms = await db.select().from(communicationsTable).where(or(...commClauses)).orderBy(communicationsTable.createdAt);
  }

  const activityLogs = await db
    .select()
    .from(eventLogsTable)
    .where(eq(eventLogsTable.debtorId, debtor.id))
    .orderBy(desc(eventLogsTable.createdAt));

  res.json({
    ...formatted,
    documents: (docs || []).map((d: any) => ({
      id: d.id,
      matterId: d.matterId,
      docType: d.docType,
      fileName: d.fileName,
      fileUrl: d.fileUrl,
      generatedById: d.generatedById,
      sentVia: d.sentVia ?? null,
      sentAt: d.sentAt?.toISOString() ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    whatsappMessages: (waMessages || []).map((m: any) => ({
      id: m.id,
      matterId: m.matterId,
      debtorId: m.debtorId,
      direction: m.direction,
      messageType: m.messageType,
      content: m.content,
      waMessageId: m.waMessageId,
      status: m.status,
      errorMsg: m.errorMsg ?? null,
      createdById: m.createdById ?? null,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    })),
    communications: (comms || []).map((c: any) => ({
      id: c.id,
      matterId: c.matterId,
      to: c.to,
      channel: c.channel,
      templateId: c.templateId,
      body: c.body,
      status: c.status,
      sentAt: c.sentAt?.toISOString() ?? null,
      createdById: c.createdById,
      createdAt: c.createdAt.toISOString(),
    })),
    activityLog: (activityLogs || []).map((a: any) => ({
      id: a.id,
      eventType: a.eventType,
      eventSource: a.eventSource,
      matterId: a.matterId,
      message: (a.payload as any)?.message ?? a.eventType,
      status: a.status,
      payload: a.payload,
      createdAt: a.createdAt.toISOString(),
    })),
  });
});

router.get("/debtors/:id/activity", async (req, res): Promise<void> => {
  const params = GetDebtorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [debtor] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, params.data.id));
  if (!debtor) {
    res.status(404).json({ error: "Debtor not found" });
    return;
  }

  const activityLogs = await db
    .select()
    .from(eventLogsTable)
    .where(eq(eventLogsTable.debtorId, debtor.id))
    .orderBy(desc(eventLogsTable.createdAt));

  res.json(
    (activityLogs || []).map((a: any) => ({
      id: a.id,
      eventType: a.eventType,
      eventSource: a.eventSource,
      matterId: a.matterId,
      message: (a.payload as any)?.message ?? a.eventType,
      status: a.status,
      payload: a.payload,
      createdAt: a.createdAt.toISOString(),
    }))
  );
});

// Realtime events are provided via WebSockets (Socket.IO). The former SSE endpoint
// has been removed; clients should connect with Socket.IO and join debtor rooms.

router.patch("/debtors/:id", async (req, res): Promise<void> => {
  const params = UpdateDebtorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDebtorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Get current debtor to check for status changes
  const [existing] = await db.select().from(debtorsTable).where(eq(debtorsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Debtor not found" });
    return;
  }

  const [debtor] = await db.update(debtorsTable).set(parsed.data).where(eq(debtorsTable.id, params.data.id)).returning();
  if (!debtor) {
    res.status(404).json({ error: "Debtor not found" });
    return;
  }

  // Check if status changed and emit event if it did
  if (parsed.data.status && existing.status !== parsed.data.status) {
    await emitEvent("DEBTOR_STATUS_CHANGED", {
      debtorId: debtor.id,
      fullName: `${debtor.firstName} ${debtor.lastName}`,
      fromStatus: existing.status,
      toStatus: parsed.data.status,
      changedById: req.user!.id,
    });
  }

  res.json(await formatDebtor(debtor));
});

router.get("/debtors/:id/matters", async (req, res): Promise<void> => {
  const params = GetDebtorMattersParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const matters = await db.select().from(mattersTable).where(eq(mattersTable.debtorId, params.data.id));
  const formatted = matters.map((m) => ({
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
  }));

  res.json(formatted);
});

// Delete debtor (admin only)
router.delete("/debtors/:id", requireRole("ADMIN"), async (req, res): Promise<void> => {
  const params = GetDebtorParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db.delete(debtorsTable).where(eq(debtorsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Debtor not found" });
    return;
  }

  res.json({ id: deleted.id });
});

export default router;

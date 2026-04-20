import { Router, type IRouter } from "express";
import { db, debtorsTable, mattersTable } from "@workspace/db";
import { eq, count, or, ilike, and } from "drizzle-orm";
import { authMiddleware, requireRole } from "../lib/auth";
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
  const page = queryParams.success && queryParams.data.page ? Math.max(1, Number(queryParams.data.page)) : 1;
  const limit = queryParams.success && queryParams.data.limit ? Math.max(1, Number(queryParams.data.limit)) : undefined;
  const offset = limit ? (page - 1) * limit : undefined;

  // Query rows with optional pagination
  let rowsQuery = db.select().from(debtorsTable).orderBy(debtorsTable.lastName);
  if (whereExpr) rowsQuery = rowsQuery.where(whereExpr);
  if (limit) rowsQuery = rowsQuery.limit(limit as any);
  if (offset) rowsQuery = rowsQuery.offset(offset as any);

  const debtors = await rowsQuery;

  const formatted = await Promise.all(debtors.map((d) => formatDebtor(d)));
  res.json({ debtors: formatted, total });
});

router.post("/debtors", async (req, res): Promise<void> => {
  const parsed = CreateDebtorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [debtor] = await db.insert(debtorsTable).values(parsed.data).returning();
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

  res.json(await formatDebtor(debtor));
});

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

  const [debtor] = await db.update(debtorsTable).set(parsed.data).where(eq(debtorsTable.id, params.data.id)).returning();
  if (!debtor) {
    res.status(404).json({ error: "Debtor not found" });
    return;
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

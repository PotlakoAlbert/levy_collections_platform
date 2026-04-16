import { Router, type IRouter } from "express";
import { db, debtorsTable, mattersTable } from "@workspace/db";
import { eq, count, or, ilike } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
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
  let debtors = await db.select().from(debtorsTable).orderBy(debtorsTable.lastName);

  if (queryParams.success) {
    if (queryParams.data.status) {
      debtors = debtors.filter((d) => d.status === queryParams.data.status);
    }
    if (queryParams.data.search) {
      const q = queryParams.data.search.toLowerCase();
      debtors = debtors.filter(
        (d) =>
          d.firstName.toLowerCase().includes(q) ||
          d.lastName.toLowerCase().includes(q) ||
          (d.idNumber ?? "").toLowerCase().includes(q) ||
          (d.companyName ?? "").toLowerCase().includes(q) ||
          (d.email ?? "").toLowerCase().includes(q)
      );
    }
  }

  const formatted = await Promise.all(debtors.map((d) => formatDebtor(d)));
  res.json(formatted);
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

export default router;

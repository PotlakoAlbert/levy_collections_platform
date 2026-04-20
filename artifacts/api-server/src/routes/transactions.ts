import { Router, type IRouter } from "express";
import { db, transactionsTable, mattersTable, usersTable } from "@workspace/db";
import { authMiddleware } from "../lib/auth";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/matters/:id/transactions", async (req, res): Promise<void> => {
  const matterId = req.params.id;
  const t = await db.select().from(transactionsTable).where(eq(transactionsTable.matterId, matterId)).orderBy(transactionsTable.createdAt);

  const enriched = await Promise.all(t.map(async trx => {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, trx.createdById));
    return {
      id: trx.id,
      matterId: trx.matterId,
      amount: parseFloat(String(trx.amount)),
      transactionType: trx.transactionType,
      postingCodeId: trx.postingCodeId ?? null,
      description: trx.description ?? null,
      createdByName: user?.name ?? null,
      createdAt: trx.createdAt.toISOString(),
    };
  }));

  res.json(enriched);
});

router.post("/matters/:id/transactions", async (req, res): Promise<void> => {
  const matterId = req.params.id;
  const body = req.body ?? {};

  if (!body.amount || !body.transactionType) {
    res.status(400).json({ error: "amount and transactionType are required" });
    return;
  }

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, matterId));
  if (!matter) {
    res.status(404).json({ error: "matter not found" });
    return;
  }

  const [trx] = await db.insert(transactionsTable).values({
    matterId,
    amount: String(body.amount),
    transactionType: String(body.transactionType),
    postingCodeId: body.postingCodeId ?? null,
    description: body.description ?? null,
    createdById: req.user!.id,
  }).returning();

  res.status(201).json({ id: trx.id, matterId: trx.matterId, amount: parseFloat(String(trx.amount)), transactionType: trx.transactionType, postingCodeId: trx.postingCodeId ?? null, description: trx.description ?? null, createdAt: trx.createdAt.toISOString() });
});

export default router;

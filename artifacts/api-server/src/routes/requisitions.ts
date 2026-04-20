import { Router, type IRouter } from "express";
import { db, paymentRequisitionsTable, mattersTable } from "@workspace/db";
import { authMiddleware } from "../lib/auth";
import { eq } from "drizzle-orm";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/requisitions", async (req, res): Promise<void> => {
  const q = req.query;
  let rows = await db.select().from(paymentRequisitionsTable).orderBy(paymentRequisitionsTable.createdAt);
  if (q.matterId) rows = rows.filter(r => r.matterId === String(q.matterId));
  res.json(rows);
});

router.post("/requisitions", async (req, res): Promise<void> => {
  const body = req.body ?? {};
  if (!body.amount) { res.status(400).json({ error: "amount required" }); return; }

  if (body.matterId) {
    const [m] = await db.select().from(mattersTable).where(eq(mattersTable.id, String(body.matterId)));
    if (!m) { res.status(404).json({ error: "matter not found" }); return; }
  }

  const [r] = await db.insert(paymentRequisitionsTable).values({
    matterId: body.matterId ?? null,
    amount: String(body.amount),
    reason: body.reason ?? null,
    payByDate: body.payByDate ? new Date(body.payByDate) : null,
    payFrom: body.payFrom ?? null,
    trustBankId: body.trustBankId ?? null,
    status: "PENDING",
    createdById: req.user!.id,
  }).returning();

  res.status(201).json(r);
});

export default router;

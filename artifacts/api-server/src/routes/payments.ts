import { Router, type IRouter } from "express";
import { db, paymentsTable, mattersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { ListPaymentsQueryParams, RecordPaymentBody } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/payments", async (req, res): Promise<void> => {
  const qp = ListPaymentsQueryParams.safeParse(req.query);
  let payments = await db.select().from(paymentsTable).orderBy(paymentsTable.receivedDate);

  if (qp.success && qp.data.matterId) {
    payments = payments.filter((p) => p.matterId === qp.data.matterId);
  }

  const enriched = await Promise.all(
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

  res.json(enriched);
});

router.post("/payments", async (req, res): Promise<void> => {
  const parsed = RecordPaymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, parsed.data.matterId));
  if (!matter) {
    res.status(400).json({ error: "Matter not found" });
    return;
  }

  const [payment] = await db.insert(paymentsTable).values({
    matterId: parsed.data.matterId,
    amount: String(parsed.data.amount),
    method: parsed.data.method,
    receivedDate: new Date(parsed.data.receivedDate),
    allocatedTo: parsed.data.allocatedTo ?? null,
    receiptedById: req.user!.id,
  }).returning();

  // Update total paid on matter
  const newPaid = parseFloat(matter.totalPaid) + parsed.data.amount;
  await db.update(mattersTable).set({ totalPaid: String(newPaid) }).where(eq(mattersTable.id, parsed.data.matterId));

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));

  res.status(201).json({
    id: payment.id,
    matterId: payment.matterId,
    amount: parseFloat(payment.amount),
    method: payment.method,
    receivedDate: payment.receivedDate.toISOString(),
    allocatedTo: payment.allocatedTo ?? null,
    receiptedByName: user?.name ?? null,
    createdAt: payment.createdAt.toISOString(),
  });
});

export default router;

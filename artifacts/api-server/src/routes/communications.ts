import { Router, type IRouter } from "express";
import { db, communicationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();
router.use(authMiddleware);

// Log and enqueue a communication (SMS/EMAIL). This endpoint does not integrate with third-party providers yet.
router.post("/communications", async (req, res): Promise<void> => {
  const body = req.body ?? {};
  if (!body.to || !body.channel || !body.body) {
    res.status(400).json({ error: "to, channel and body are required" });
    return;
  }

  const [c] = await db.insert(communicationsTable).values({
    matterId: body.matterId ?? null,
    to: String(body.to),
    channel: String(body.channel),
    templateId: body.templateId ?? null,
    body: String(body.body),
    sentAt: null,
    status: "PENDING",
    createdById: req.user!.id,
  }).returning();

  // In future we will enqueue to a worker; for now return the record
  res.status(201).json(c);
});

// List communications (optionally filtered by matterId)
router.get("/communications", async (req, res): Promise<void> => {
  const matterId = req.query.matterId as string | undefined;

  let rows = await db.select().from(communicationsTable).orderBy(communicationsTable.createdAt);
  if (matterId) rows = rows.filter((r) => r.matterId === matterId);

  const enriched = await Promise.all(
    rows.map(async (r) => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, r.createdById));
      return {
        id: r.id,
        matterId: r.matterId ?? null,
        to: r.to,
        channel: r.channel,
        templateId: r.templateId ?? null,
        body: r.body,
        sentAt: r.sentAt?.toISOString() ?? null,
        status: r.status,
        createdById: r.createdById,
        createdByName: user?.name ?? null,
        createdAt: r.createdAt.toISOString(),
      };
    })
  );

  res.json(enriched);
});

export default router;


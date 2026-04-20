import { Router, type IRouter } from "express";
import { db, communicationsTable } from "@workspace/db";
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

export default router;

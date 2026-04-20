import { Router, type IRouter } from "express";
import { db, postingCodesTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../lib/auth";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/posting-codes", async (_req, res): Promise<void> => {
  const codes = await db.select().from(postingCodesTable).orderBy(postingCodesTable.code);
  res.json(codes.map(c => ({ id: c.id, code: c.code, name: c.name, type: c.type, description: c.description })));
});

router.post("/posting-codes", requireRole("ADMIN"), async (req, res): Promise<void> => {
  const body = req.body ?? {};
  if (!body.code || !body.name) {
    res.status(400).json({ error: "code and name required" });
    return;
  }

  const [pc] = await db.insert(postingCodesTable).values({
    code: String(body.code),
    name: String(body.name),
    type: String(body.type ?? "UNBILLED"),
    description: body.description ?? null,
    createdById: req.user!.id,
  }).returning();

  res.status(201).json({ id: pc.id, code: pc.code, name: pc.name, type: pc.type, description: pc.description });
});

export default router;

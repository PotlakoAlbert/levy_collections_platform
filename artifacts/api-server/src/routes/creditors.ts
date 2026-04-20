import { Router, type IRouter } from "express";
import { db, creditorsTable } from "@workspace/db";
import { authMiddleware } from "../lib/auth";

const router: IRouter = Router();
router.use(authMiddleware);

router.get("/creditors", async (_req, res): Promise<void> => {
  const cs = await db.select().from(creditorsTable).orderBy(creditorsTable.name);
  res.json(cs);
});

router.post("/creditors", async (req, res): Promise<void> => {
  const body = req.body ?? {};
  if (!body.name) {
    res.status(400).json({ error: "name required" });
    return;
  }

  const [c] = await db.insert(creditorsTable).values({
    name: String(body.name),
    accountNumber: body.accountNumber ?? null,
    contact: body.contact ?? null,
  }).returning();

  res.status(201).json(c);
});

export default router;

import { Router, type IRouter } from "express";
import { db, managingAgentsTable, schemesTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { CreateAgentBody, UpdateAgentBody, GetAgentParams, UpdateAgentParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.use(authMiddleware);

async function formatAgent(agent: typeof managingAgentsTable.$inferSelect, includeCounts = true) {
  let schemeCount: number | null = null;
  if (includeCounts) {
    const [row] = await db.select({ count: count() }).from(schemesTable).where(eq(schemesTable.agentId, agent.id));
    schemeCount = row?.count ?? 0;
  }

  return {
    id: agent.id,
    name: agent.name,
    contactEmail: agent.contactEmail ?? null,
    contactPhone: agent.contactPhone ?? null,
    isActive: agent.isActive,
    createdAt: agent.createdAt.toISOString(),
    schemeCount,
  };
}

router.get("/agents", async (_req, res): Promise<void> => {
  const agents = await db.select().from(managingAgentsTable).orderBy(managingAgentsTable.name);
  const formatted = await Promise.all(agents.map((a) => formatAgent(a)));
  res.json(formatted);
});

router.post("/agents", async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db.insert(managingAgentsTable).values(parsed.data).returning();
  res.status(201).json(await formatAgent(agent, false));
});

router.get("/agents/:id", async (req, res): Promise<void> => {
  const params = GetAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [agent] = await db.select().from(managingAgentsTable).where(eq(managingAgentsTable.id, params.data.id));
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(await formatAgent(agent));
});

router.patch("/agents/:id", async (req, res): Promise<void> => {
  const params = UpdateAgentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [agent] = await db
    .update(managingAgentsTable)
    .set(parsed.data)
    .where(eq(managingAgentsTable.id, params.data.id))
    .returning();

  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  res.json(await formatAgent(agent));
});

export default router;

import { Router, type IRouter } from "express";
import { db, schemesTable, managingAgentsTable, mattersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { CreateSchemeBody, UpdateSchemeBody, GetSchemeParams, UpdateSchemeParams, ListSchemesQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.use(authMiddleware);

async function formatScheme(scheme: typeof schemesTable.$inferSelect) {
  const [agent] = await db.select().from(managingAgentsTable).where(eq(managingAgentsTable.id, scheme.agentId));
  const [matterRow] = await db.select({ count: count() }).from(mattersTable).where(eq(mattersTable.schemeId, scheme.id));

  return {
    id: scheme.id,
    name: scheme.name,
    agentId: scheme.agentId,
    agentName: agent?.name ?? null,
    address: scheme.address ?? null,
    levyAmount: scheme.levyAmount ? parseFloat(scheme.levyAmount) : null,
    isActive: scheme.isActive,
    createdAt: scheme.createdAt.toISOString(),
    matterCount: matterRow?.count ?? 0,
  };
}

router.get("/schemes", async (req, res): Promise<void> => {
  const queryParams = ListSchemesQueryParams.safeParse(req.query);

  let schemes = await db.select().from(schemesTable).orderBy(schemesTable.name);
  if (queryParams.success && queryParams.data.agentId) schemes = schemes.filter((s) => s.agentId === queryParams.data.agentId);

  const total = schemes.length;

  const page = queryParams.success && (queryParams.data as any).page ? Math.max(1, Number((queryParams.data as any).page)) : 1;
  const limit = queryParams.success && (queryParams.data as any).limit ? Math.max(1, Number((queryParams.data as any).limit)) : undefined;
  const offset = limit ? (page - 1) * limit : 0;

  const pageSlice = typeof limit === "number" ? schemes.slice(offset, offset + limit) : schemes;

  const formatted = await Promise.all(pageSlice.map(formatScheme));
  res.json({ schemes: formatted, total });
});

router.post("/schemes", async (req, res): Promise<void> => {
  const parsed = CreateSchemeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [scheme] = await db.insert(schemesTable).values({
    name: parsed.data.name,
    agentId: parsed.data.agentId,
    address: parsed.data.address ?? null,
    levyAmount: parsed.data.levyAmount != null ? String(parsed.data.levyAmount) : null,
  }).returning();

  res.status(201).json(await formatScheme(scheme));
});

router.get("/schemes/:id", async (req, res): Promise<void> => {
  const params = GetSchemeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [scheme] = await db.select().from(schemesTable).where(eq(schemesTable.id, params.data.id));
  if (!scheme) {
    res.status(404).json({ error: "Scheme not found" });
    return;
  }

  res.json(await formatScheme(scheme));
});

router.patch("/schemes/:id", async (req, res): Promise<void> => {
  const params = UpdateSchemeParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateSchemeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name != null) updates.name = parsed.data.name;
  if (parsed.data.agentId != null) updates.agentId = parsed.data.agentId;
  if ("address" in parsed.data) updates.address = parsed.data.address;
  if ("levyAmount" in parsed.data) updates.levyAmount = parsed.data.levyAmount != null ? String(parsed.data.levyAmount) : null;
  if (parsed.data.isActive != null) updates.isActive = parsed.data.isActive;
  if (parsed.data.isActive === false) updates.archivedAt = new Date();
  if (parsed.data.isActive === true) updates.archivedAt = null;

  const [scheme] = await db.update(schemesTable).set(updates).where(eq(schemesTable.id, params.data.id)).returning();
  if (!scheme) {
    res.status(404).json({ error: "Scheme not found" });
    return;
  }

  res.json(await formatScheme(scheme));
});

export default router;

import { Router, type IRouter } from "express";
import { db, tasksTable, mattersTable, usersTable } from "@workspace/db";
import { eq, and, lt, count } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { ListTasksQueryParams, CreateTaskBody, UpdateTaskParams, UpdateTaskBody, CompleteTaskParams, CompleteTaskBody } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(authMiddleware);

async function formatTask(t: typeof tasksTable.$inferSelect) {
  const [matter] = await db.select().from(mattersTable).where(eq(mattersTable.id, t.matterId));
  const [assignee] = await db.select().from(usersTable).where(eq(usersTable.id, t.assigneeId));

  // Auto-mark overdue
  let status = t.status;
  if (status === "PENDING" && t.dueDate && t.dueDate < new Date()) {
    status = "OVERDUE";
    await db.update(tasksTable).set({ status: "OVERDUE" }).where(eq(tasksTable.id, t.id));
  }

  return {
    id: t.id,
    matterId: t.matterId,
    matterReference: matter?.reference ?? null,
    title: t.title,
    description: t.description ?? null,
    status,
    priority: t.priority,
    dueDate: t.dueDate?.toISOString() ?? null,
    assigneeId: t.assigneeId,
    assigneeName: assignee?.name ?? null,
    isAutoGen: t.isAutoGen,
    completedAt: t.completedAt?.toISOString() ?? null,
    completionNote: t.completionNote ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const qp = ListTasksQueryParams.safeParse(req.query);

  // Build WHERE expression
  let whereExpr: any = undefined;
  if (qp.success) {
    const clauses: any[] = [];
    if (qp.data.matterId) clauses.push(eq(tasksTable.matterId, qp.data.matterId));
    if (qp.data.assigneeId) clauses.push(eq(tasksTable.assigneeId, qp.data.assigneeId));
    if (qp.data.status) clauses.push(eq(tasksTable.status, qp.data.status));
    if (qp.data.myTasks === "true") clauses.push(eq(tasksTable.assigneeId, req.user!.id));

    if (clauses.length === 1) whereExpr = clauses[0];
    else if (clauses.length > 1) whereExpr = and(...clauses);
  }

  // total count
  const totalRow = whereExpr
    ? await db.select({ count: count() }).from(tasksTable).where(whereExpr)
    : await db.select({ count: count() }).from(tasksTable);
  const total = Number(totalRow?.[0]?.count ?? 0);

  const page = qp.success && qp.data.page ? Math.max(1, Number(qp.data.page)) : 1;
  const limit = qp.success && qp.data.limit ? Math.max(1, Number(qp.data.limit)) : undefined;
  const offset = limit ? (page - 1) * limit : undefined;

  let rowsQuery = db.select().from(tasksTable).orderBy(tasksTable.dueDate);
  if (whereExpr) rowsQuery = rowsQuery.where(whereExpr);
  if (limit) rowsQuery = rowsQuery.limit(limit as any);
  if (offset) rowsQuery = rowsQuery.offset(offset as any);

  const tasks = await rowsQuery;
  const formatted = await Promise.all(tasks.map(formatTask));
  res.json({ tasks: formatted, total });
});

router.post("/tasks", async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [task] = await db.insert(tasksTable).values({
    matterId: parsed.data.matterId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    priority: parsed.data.priority,
    dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    assigneeId: parsed.data.assigneeId,
    isAutoGen: false,
    status: "PENDING",
  }).returning();

  res.status(201).json(await formatTask(task));
});

router.patch("/tasks/:id", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.title != null) updates.title = parsed.data.title;
  if (parsed.data.description != null) updates.description = parsed.data.description;
  if (parsed.data.priority != null) updates.priority = parsed.data.priority;
  if ("dueDate" in parsed.data) updates.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  if (parsed.data.assigneeId != null) updates.assigneeId = parsed.data.assigneeId;
  if (parsed.data.status != null) updates.status = parsed.data.status;

  const [task] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, params.data.id)).returning();
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(await formatTask(task));
});

router.patch("/tasks/:id/complete", async (req, res): Promise<void> => {
  const params = CompleteTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CompleteTaskBody.safeParse(req.body);

  const [task] = await db
    .update(tasksTable)
    .set({
      status: "COMPLETED",
      completedAt: new Date(),
      completionNote: parsed.success ? (parsed.data.note ?? null) : null,
    })
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json(await formatTask(task));
});

export default router;

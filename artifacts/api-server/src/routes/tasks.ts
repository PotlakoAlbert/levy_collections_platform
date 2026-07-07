import { Router, type IRouter } from "express";
import { db, tasksTable, mattersTable, usersTable, auditLogsTable } from "@workspace/db";
import { eq, and, count, isNull, isNotNull } from "drizzle-orm";
import { authMiddleware } from "../lib/auth";
import { ListTasksQueryParams, CreateTaskBody, UpdateTaskParams, UpdateTaskBody, CompleteTaskParams, CompleteTaskBody } from "@workspace/api-zod";

const router: IRouter = Router();
router.use(authMiddleware);

async function formatTask(t: typeof tasksTable.$inferSelect) {
  const [matter] = t.matterId ? await db.select().from(mattersTable).where(eq(mattersTable.id, t.matterId)) : [null];
  const [assignee] = await db.select().from(usersTable).where(eq(usersTable.id, t.assigneeId));

  // Auto-mark overdue (skip archived tasks)
  let status = t.status;
  if (!t.archivedAt && status === "PENDING" && t.dueDate && t.dueDate < new Date()) {
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
    archivedAt: t.archivedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/tasks", async (req, res): Promise<void> => {
  const qp = ListTasksQueryParams.safeParse(req.query);

  const archivedOnly = req.query.archivedOnly === "true";
  const includeArchived = req.query.includeArchived === "true";

  // Build WHERE expression
  let whereExpr: any = undefined;
  const clauses: any[] = [];
  if (archivedOnly) {
    clauses.push(isNotNull(tasksTable.archivedAt));
  } else if (!includeArchived) {
    clauses.push(isNull(tasksTable.archivedAt));
  }

  if (qp.success) {
    if (qp.data.matterId) clauses.push(eq(tasksTable.matterId, qp.data.matterId));
    if (qp.data.assigneeId) clauses.push(eq(tasksTable.assigneeId, qp.data.assigneeId));
    if (qp.data.status) clauses.push(eq(tasksTable.status, qp.data.status));
    if (qp.data.myTasks === "true") clauses.push(eq(tasksTable.assigneeId, req.user!.id));
  }

  if (clauses.length === 1) whereExpr = clauses[0];
  else if (clauses.length > 1) whereExpr = and(...clauses);

  // total count
  const totalRow = whereExpr
    ? await db.select({ count: count() }).from(tasksTable).where(whereExpr)
    : await db.select({ count: count() }).from(tasksTable);
  const total = Number(totalRow?.[0]?.count ?? 0);

  const page = qp.success && (qp.data as any).page ? Math.max(1, Number((qp.data as any).page)) : 1;
  const limit = qp.success && (qp.data as any).limit ? Math.max(1, Number((qp.data as any).limit)) : undefined;
  const offset = limit ? (page - 1) * limit : undefined;

  let rowsQuery: any = db.select().from(tasksTable).orderBy(tasksTable.dueDate);
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
    taskType: "MANUAL",
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

  // fetch old task for audit
  const [oldTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));

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

  // record audit log
  try {
    await db.insert(auditLogsTable).values({
      userId: req.user?.id ?? null,
      action: "update",
      entityType: "task",
      entityId: task.id,
      oldData: oldTask ? JSON.stringify(await formatTask(oldTask)) : null,
      newData: JSON.stringify(await formatTask(task)),
    });
  } catch (err) {
    // non-fatal
    console.error("Failed to record task audit log", err);
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

  // fetch old task for audit
  const [oldTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));

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

  // record audit log for completion
  try {
    await db.insert(auditLogsTable).values({
      userId: req.user?.id ?? null,
      action: "complete",
      entityType: "task",
      entityId: task.id,
      oldData: oldTask ? JSON.stringify(await formatTask(oldTask)) : null,
      newData: JSON.stringify(await formatTask(task)),
    });
  } catch (err) {
    console.error("Failed to record task completion audit log", err);
  }

  res.json(await formatTask(task));
});

router.patch("/tasks/:id/archive", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [oldTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  const [task] = await db
    .update(tasksTable)
    .set({ archivedAt: new Date() })
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  try {
    await db.insert(auditLogsTable).values({
      userId: req.user?.id ?? null,
      action: "archive",
      entityType: "task",
      entityId: task.id,
      oldData: oldTask ? JSON.stringify(await formatTask({ ...oldTask, archivedAt: null })) : null,
      newData: JSON.stringify(await formatTask(task)),
    });
  } catch (err) {
    console.error("Failed to record task archive audit log", err);
  }

  res.json(await formatTask(task));
});

router.patch("/tasks/:id/unarchive", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [oldTask] = await db.select().from(tasksTable).where(eq(tasksTable.id, params.data.id));
  const [task] = await db
    .update(tasksTable)
    .set({ archivedAt: null })
    .where(eq(tasksTable.id, params.data.id))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  try {
    await db.insert(auditLogsTable).values({
      userId: req.user?.id ?? null,
      action: "unarchive",
      entityType: "task",
      entityId: task.id,
      oldData: oldTask ? JSON.stringify(await formatTask(oldTask)) : null,
      newData: JSON.stringify(await formatTask(task)),
    });
  } catch (err) {
    console.error("Failed to record task unarchive audit log", err);
  }

  res.json(await formatTask(task));
});

router.get("/tasks/:id/history", async (req, res): Promise<void> => {
  const params = UpdateTaskParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const logs = await db.select().from(auditLogsTable).where(and(eq(auditLogsTable.entityType, "task"), eq(auditLogsTable.entityId, params.data.id)));

  const formatted = await Promise.all(logs.map(async (l: any) => {
    const [user] = l.userId ? await db.select().from(usersTable).where(eq(usersTable.id, l.userId)) : [null];
    return {
      id: l.id,
      action: l.action,
      userId: l.userId ?? null,
      userName: user?.name ?? null,
      oldData: l.oldData ? JSON.parse(l.oldData) : null,
      newData: l.newData ? JSON.parse(l.newData) : null,
      createdAt: l.createdAt.toISOString(),
    };
  }));

  // sort by createdAt desc
  formatted.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  res.json({ history: formatted });
});

export default router;

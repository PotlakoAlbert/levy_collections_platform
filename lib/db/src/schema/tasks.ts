import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const tasksTable = pgTable("tasks", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("PENDING"), // PENDING, COMPLETED, OVERDUE
  priority: text("priority").notNull().default("NORMAL"), // LOW, NORMAL, HIGH, URGENT
  dueDate: timestamp("due_date", { withTimezone: true }),
  assigneeId: text("assignee_id").notNull(),
  isAutoGen: boolean("is_auto_gen").notNull().default(false),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completionNote: text("completion_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;

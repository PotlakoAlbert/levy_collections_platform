import { pgTable, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * TASK HISTORY TABLE
 * Stores completed/archived tasks for historical tracking
 * Allows users to view past tasks and task history
 */
export const taskHistoryTable = pgTable("task_history", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  taskId: text("task_id").notNull(),
  matterId: text("matter_id"),
  title: text("title").notNull(),
  description: text("description"),
  taskType: text("task_type").notNull().default("AUTO_GENERATED"), // AUTO_GENERATED, MANUAL
  priority: text("priority").notNull().default("NORMAL"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedDate: timestamp("completed_date", { withTimezone: true }),
  completionNote: text("completion_note"),
  assigneeId: text("assignee_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTaskHistorySchema = createInsertSchema(taskHistoryTable).omit({ id: true, createdAt: true });
export type InsertTaskHistory = z.infer<typeof insertTaskHistorySchema>;
export type TaskHistory = typeof taskHistoryTable.$inferSelect;

/**
 * MATTER DOCUMENTS HISTORY TABLE
 * Tracks all documents generated/sent for a matter
 * Stores: LOD sent, how sent (WhatsApp/Email), templates, versions
 */
export const matterDocumentsTable = pgTable("matter_documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id").notNull(),
  documentType: text("document_type").notNull(), // LOD, S129, SUMMONS, JUDGMENT, WRIT, AGREEMENT
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"), // S3/R2 URL
  version: integer("version").notNull().default(1),
  sentVia: text("sent_via"), // WHATSAPP, EMAIL, SMS, POSTAL, HAND_DELIVERY
  sentDate: timestamp("sent_date", { withTimezone: true }),
  sentTo: text("sent_to"), // Phone/Email address
  status: text("status").notNull().default("DRAFT"), // DRAFT, SENT, DELIVERED, FAILED
  template: text("template"), // Template used
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMatterDocumentSchema = createInsertSchema(matterDocumentsTable).omit({ id: true, version: true, createdAt: true, updatedAt: true });
export type InsertMatterDocument = z.infer<typeof insertMatterDocumentSchema>;
export type MatterDocument = typeof matterDocumentsTable.$inferSelect;


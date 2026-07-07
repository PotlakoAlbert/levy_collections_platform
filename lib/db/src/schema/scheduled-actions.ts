import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Tracks future automated actions scheduled for execution
 * Used by automation engine to queue up work that should happen at specific times
 * Example: Send reminder in 7 days, escalate to attorney if no payment by date X
 */
export const scheduledActionsTable = pgTable("scheduled_actions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id").notNull(),
  debtorId: text("debtor_id"),
  actionType: text("action_type").notNull(), // SEND_REMINDER, ESCALATE, AUTO_ADVANCE, SEND_LOD, etc.
  actionPayload: jsonb("action_payload").notNull(), // Parameters for the action
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(), // When should this run
  priority: text("priority").notNull().default("NORMAL"), // HIGH, NORMAL, LOW
  status: text("status").notNull().default("PENDING"), // PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED
  executedAt: timestamp("executed_at", { withTimezone: true }),
  executionError: text("execution_error"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

import { integer } from "drizzle-orm/pg-core";

export const insertScheduledActionSchema = createInsertSchema(scheduledActionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScheduledAction = z.infer<typeof insertScheduledActionSchema>;
export type ScheduledAction = typeof scheduledActionsTable.$inferSelect;

export default scheduledActionsTable;

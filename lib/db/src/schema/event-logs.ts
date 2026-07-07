import { pgTable, text, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Complete audit trail of all system events
 * Used for compliance, debugging, and analytics
 */
export const eventLogsTable = pgTable("event_logs", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventType: text("event_type").notNull(), // MATTER_CREATED, PAYMENT_RECEIVED, etc.
  eventSource: text("event_source").notNull(), // System source (API, WHATSAPP, CRON, etc.)
  matterId: text("matter_id"), // Optional - links to affected matter
  debtorId: text("debtor_id"), // Optional - links to affected debtor
  userId: text("user_id"), // Optional - who triggered it
  payload: jsonb("payload").notNull(), // Full event data
  status: text("status").notNull().default("COMPLETED"), // COMPLETED, FAILED, PENDING_RETRY
  retryCount: integer("retry_count").notNull().default(0),
  error: text("error"), // Error message if failed
  idempotencyKey: text("idempotency_key"), // For deduplication
  processedAt: timestamp("processed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventLogSchema = createInsertSchema(eventLogsTable).omit({ id: true, createdAt: true });
export type InsertEventLog = z.infer<typeof insertEventLogSchema>;
export type EventLog = typeof eventLogsTable.$inferSelect;

export default eventLogsTable;

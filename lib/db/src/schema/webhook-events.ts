import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Stores raw webhook payloads from external services
 * Ensures we can replay/debug webhooks and prevent duplicate processing
 */
export const webhookEventsTable = pgTable("webhook_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  source: text("source").notNull(), // WHATSAPP, PAYMENT_GATEWAY, etc.
  eventType: text("event_type").notNull(), // message, status_update, payment, etc.
  debtorId: text("debtor_id"), // Link to debtor if applicable
  matterId: text("matter_id"), // Link to matter if applicable
  rawPayload: jsonb("raw_payload").notNull(), // Complete unmodified webhook data
  signature: text("signature"), // Webhook signature for verification
  signatureValid: boolean("signature_valid").notNull().default(false),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  processError: text("process_error"), // Error if processing failed
  idempotencyKey: text("idempotency_key").unique(), // Prevent duplicate processing
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWebhookEventSchema = createInsertSchema(webhookEventsTable).omit({ id: true, createdAt: true });
export type InsertWebhookEvent = z.infer<typeof insertWebhookEventSchema>;
export type WebhookEvent = typeof webhookEventsTable.$inferSelect;

export default webhookEventsTable;

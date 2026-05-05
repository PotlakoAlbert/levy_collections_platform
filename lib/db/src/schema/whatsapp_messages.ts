import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const whatsappMessagesTable = pgTable("whatsapp_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id"),
  debtorId: text("debtor_id"),
  direction: text("direction").notNull(), // INBOUND, OUTBOUND
  messageType: text("message_type"), // text, document, template
  content: text("content"),
  waMessageId: text("wa_message_id"), // WhatsApp message ID from API
  status: text("status").notNull().default("QUEUED"), // QUEUED, SENT, DELIVERED, READ, FAILED
  errorMsg: text("error_msg"),
  createdById: text("created_by_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappMessage = typeof whatsappMessagesTable.$inferSelect;

export default whatsappMessagesTable;

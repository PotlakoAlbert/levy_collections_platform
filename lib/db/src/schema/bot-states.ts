import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Tracks WhatsApp bot conversation state per matter
 * Stores context so bot remembers conversation history and can follow up intelligently
 * Example: Bot knows debtor offered R500/month, has been negotiating for 3 messages, is now waiting for confirmation
 */
export const botConversationStatesTable = pgTable("bot_conversation_states", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id").notNull().unique(), // One state per matter
  debtorId: text("debtor_id").notNull(),
  state: text("state").notNull().default("INITIAL"), // INITIAL, AWAITING_RESPONSE, NEGOTIATING, AWAITING_CONFIRMATION, ARRANGEMENT_MADE, ESCALATED
  context: text("context"), // JSON with conversation context (offers made, history, etc.)
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
  lastBotMessageAt: timestamp("last_bot_message_at", { withTimezone: true }),
  messageCount: text("message_count").default("0"), // How many messages exchanged
  escalationReason: text("escalation_reason"), // Why was it escalated to human
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBotConversationStateSchema = createInsertSchema(botConversationStatesTable).omit({ id: true, updatedAt: true });
export type InsertBotConversationState = z.infer<typeof insertBotConversationStateSchema>;
export type BotConversationState = typeof botConversationStatesTable.$inferSelect;

import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const communicationsTable = pgTable("communications", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id"),
  to: text("to").notNull(),
  channel: text("channel").notNull(), // SMS, EMAIL
  templateId: text("template_id"),
  body: text("body").notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  status: text("status").notNull().default("PENDING"),
  createdById: text("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCommunicationSchema = createInsertSchema(communicationsTable).omit({ id: true, createdAt: true });
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;
export type Communication = typeof communicationsTable.$inferSelect;

export default communicationsTable;

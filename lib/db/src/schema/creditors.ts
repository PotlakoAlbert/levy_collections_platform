import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creditorsTable = pgTable("creditors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  accountNumber: text("account_number"),
  contact: text("contact"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCreditorSchema = createInsertSchema(creditorsTable).omit({ id: true, createdAt: true });
export type InsertCreditor = z.infer<typeof insertCreditorSchema>;
export type Creditor = typeof creditorsTable.$inferSelect;

export default creditorsTable;

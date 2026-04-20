import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  transactionType: text("transaction_type").notNull(), // FEE, NOTE, CREDIT, DEBIT
  postingCodeId: text("posting_code_id"),
  description: text("description"),
  createdById: text("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;

export default transactionsTable;

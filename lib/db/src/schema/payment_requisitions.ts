import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentRequisitionsTable = pgTable("payment_requisitions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason"),
  payByDate: timestamp("pay_by_date", { withTimezone: true }),
  payFrom: text("pay_from"), // bank account identifier
  trustBankId: text("trust_bank_id"),
  status: text("status").notNull().default("PENDING"), // PENDING, APPROVED, PROCESSED
  createdById: text("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaymentRequisitionSchema = createInsertSchema(paymentRequisitionsTable).omit({ id: true, createdAt: true });
export type InsertPaymentRequisition = z.infer<typeof insertPaymentRequisitionSchema>;
export type PaymentRequisition = typeof paymentRequisitionsTable.$inferSelect;

export default paymentRequisitionsTable;

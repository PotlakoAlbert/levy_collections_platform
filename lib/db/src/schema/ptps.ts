import { pgTable, text, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const promiseToPayTable = pgTable("promise_to_pay", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id").notNull(),
  firstPaymentDate: timestamp("first_payment_date", { withTimezone: true }).notNull(),
  firstPaymentAmount: numeric("first_payment_amount", { precision: 12, scale: 2 }).notNull(),
  installmentDay: text("installment_day").notNull(),
  installmentAmount: numeric("installment_amount", { precision: 12, scale: 2 }).notNull(),
  promiseDate: timestamp("promise_date", { withTimezone: true }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdById: text("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPtpSchema = createInsertSchema(promiseToPayTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPtp = z.infer<typeof insertPtpSchema>;
export type Ptp = typeof promiseToPayTable.$inferSelect;

export default promiseToPayTable;

import { pgTable, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interestRatesTable = pgTable("interest_rates", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  rate: numeric("rate", { precision: 5, scale: 4 }).notNull(), // e.g. 0.1075 for 10.75%
  effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),
  effectiveTo: timestamp("effective_to", { withTimezone: true }),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInterestRateSchema = createInsertSchema(interestRatesTable).omit({ id: true, createdAt: true });
export type InsertInterestRate = z.infer<typeof insertInterestRateSchema>;
export type InterestRate = typeof interestRatesTable.$inferSelect;

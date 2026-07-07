import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Defines rules for automatically advancing matter stages
 * Example: After 10 days in LOD with no response, advance to S129
 */
export const autoAdvanceRulesTable = pgTable("auto_advance_rules", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  fromStage: text("from_stage").notNull(), // LOD, S129, SUMMONS, JUDGMENT, WRIT, RULE46, SALE
  toStage: text("to_stage").notNull(),
  conditionDays: integer("condition_days").notNull(), // advance after X days
  condition: text("condition").notNull(), // NO_RESPONSE, PAYMENT_FAILED, PRESCRIPTION_WARNING
  enabled: boolean("enabled").notNull().default(true),
  description: text("description"), // Human readable description
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertAutoAdvanceRuleSchema = createInsertSchema(autoAdvanceRulesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAutoAdvanceRule = z.infer<typeof insertAutoAdvanceRuleSchema>;
export type AutoAdvanceRule = typeof autoAdvanceRulesTable.$inferSelect;

import { pgTable, text, boolean, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const mattersTable = pgTable("matters", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  reference: text("reference").notNull().unique(),
  debtorId: text("debtor_id").notNull(),
  schemeId: text("scheme_id").notNull(),
  unit: text("unit").notNull(),
  stage: text("stage").notNull().default("LOD"), // LOD, S129, SUMMONS, JUDGMENT, WRIT, RULE46, SALE, CLOSED
  priority: text("priority").notNull().default("MEDIUM"), // LOW, MEDIUM, HIGH, CRITICAL
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, ON_HOLD, SETTLED, PAID_IN_FULL, WRITTEN_OFF
  capitalArrears: numeric("capital_arrears", { precision: 12, scale: 2 }).notNull().default("0"),
  interest: numeric("interest", { precision: 12, scale: 2 }).notNull().default("0"),
  legalCosts: numeric("legal_costs", { precision: 12, scale: 2 }).notNull().default("0"),
  totalPaid: numeric("total_paid", { precision: 12, scale: 2 }).notNull().default("0"),
  interestFromDate: timestamp("interest_from_date", { withTimezone: true }),
  lodDate: timestamp("lod_date", { withTimezone: true }),
  s129Date: timestamp("s129_date", { withTimezone: true }),
  summonsDate: timestamp("summons_date", { withTimezone: true }),
  judgmentDate: timestamp("judgment_date", { withTimezone: true }),
  writDate: timestamp("writ_date", { withTimezone: true }),
  saleDate: timestamp("sale_date", { withTimezone: true }),
  assignedToId: text("assigned_to_id"),
  createdById: text("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMatterSchema = createInsertSchema(mattersTable).omit({ id: true, reference: true, interest: true, totalPaid: true, createdAt: true, updatedAt: true });
export type InsertMatter = z.infer<typeof insertMatterSchema>;
export type Matter = typeof mattersTable.$inferSelect;

export const matterCountersTable = pgTable("matter_counters", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  year: integer("year").notNull(),
  count: integer("count").notNull().default(0),
});

import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const debtorsTable = pgTable("debtors", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  idNumber: text("id_number"),
  companyName: text("company_name"),
  email: text("email"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  physicalAddress: text("physical_address"),
  status: text("status").notNull().default("ACTIVE"), // ACTIVE, PAYING, DEFAULTING, ABSCONDED
  isArchived: boolean("is_archived").notNull().default(false), // Phase 2: Soft delete field
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDebtorSchema = createInsertSchema(debtorsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDebtor = z.infer<typeof insertDebtorSchema>;
export type Debtor = typeof debtorsTable.$inferSelect;

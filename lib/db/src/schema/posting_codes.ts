import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const postingCodesTable = pgTable("posting_codes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull().default("UNBILLED"), // UNBILLED, UNBILLABLE, COST_RECOVERY
  description: text("description"),
  createdById: text("created_by_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPostingCodeSchema = createInsertSchema(postingCodesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPostingCode = z.infer<typeof insertPostingCodeSchema>;
export type PostingCode = typeof postingCodesTable.$inferSelect;

export default postingCodesTable;

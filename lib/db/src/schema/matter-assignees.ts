import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Junction table for multi-user assignment per matter
 * A matter can be assigned to multiple users (team-based collection)
 * Example: Attorney A drafts LOD, Attorney B handles negotiation, Attorney C follows up on payment
 */
export const matterAssigneesTable = pgTable("matter_assignees", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id").notNull(),
  userId: text("user_id").notNull(),
  role: text("role").default("COLLECTOR"), // COLLECTOR, NEGOTIATOR, ADVISOR, SUPERVISOR
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
  assignedById: text("assigned_by_id").notNull(), // Who assigned this user
  unassignedAt: timestamp("unassigned_at", { withTimezone: true }), // When they were removed
  notes: text("notes"), // Assignment notes (why they're assigned)
});

export const insertMatterAssigneeSchema = createInsertSchema(matterAssigneesTable).omit({ id: true, assignedAt: true });
export type InsertMatterAssignee = z.infer<typeof insertMatterAssigneeSchema>;
export type MatterAssignee = typeof matterAssigneesTable.$inferSelect;

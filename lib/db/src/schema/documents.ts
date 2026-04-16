import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const documentsTable = pgTable("documents", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id").notNull(),
  docType: text("doc_type").notNull(), // LOD, S129_NOTICE, SUMMONS, DEFAULT_JUDGMENT, WRIT, RULE46_NOTICE, JOINDER_NOTICE, PAYMENT_ARRANGEMENT, STATEMENT
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  generatedById: text("generated_by_id").notNull(),
  sentVia: text("sent_via"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, createdAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;

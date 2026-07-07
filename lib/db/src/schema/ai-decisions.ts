import { pgTable, text, timestamp, jsonb, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Detailed logging of all AI decisions and reasoning
 * Required for compliance, auditing, and understanding bot behavior
 * Stores prompts, responses, and reasoning for every AI-assisted decision
 */
export const aiDecisionsTable = pgTable("ai_decisions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  matterId: text("matter_id").notNull(),
  debtorId: text("debtor_id"),
  decisionType: text("decision_type").notNull(), // CLASSIFY_INTENT, DRAFT_DOCUMENT, RECOMMEND_STAGE, ASSESS_RISK, etc.
  prompt: text("prompt").notNull(), // The prompt sent to AI
  promptVersion: text("prompt_version").notNull(), // Version of prompt template used
  aiProvider: text("ai_provider").notNull(), // GEMINI, DEEPSEEK, etc.
  aiModel: text("ai_model").notNull(), // Model name
  input: jsonb("input").notNull(), // Structured input to AI
  output: jsonb("output").notNull(), // AI response
  confidence: numeric("confidence", { precision: 3, scale: 2 }), // 0.0 to 1.0
  approved: boolean("approved"), // Was this approved by a human?
  approvedBy: text("approved_by"), // User who approved
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  executionTime: numeric("execution_time"), // ms taken to generate response
  tokensUsed: text("tokens_used"), // JSON with prompt_tokens, completion_tokens
  hallucination: text("hallucination"), // Did AI hallucinate? null = no, text = what
  reasoning: text("reasoning"), // Human notes on the decision
  actionTaken: text("action_taken"), // What action resulted from this decision
  outcome: text("outcome"), // Result: SUCCESS, FAILED, CANCELLED, etc.
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiDecisionSchema = createInsertSchema(aiDecisionsTable).omit({ id: true, createdAt: true });
export type InsertAiDecision = z.infer<typeof insertAiDecisionSchema>;
export type AiDecision = typeof aiDecisionsTable.$inferSelect;

export default aiDecisionsTable;

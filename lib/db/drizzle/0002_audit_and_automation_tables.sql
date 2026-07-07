-- Audit and automation support tables

CREATE TABLE IF NOT EXISTS "event_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "event_type" text NOT NULL,
  "event_source" text NOT NULL,
  "matter_id" text,
  "debtor_id" text,
  "user_id" text,
  "payload" jsonb NOT NULL,
  "status" text DEFAULT 'COMPLETED' NOT NULL,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "error" text,
  "idempotency_key" text,
  "processed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "event_logs_debtor_id_idx" ON "event_logs"("debtor_id");
CREATE INDEX IF NOT EXISTS "event_logs_matter_id_idx" ON "event_logs"("matter_id");
CREATE INDEX IF NOT EXISTS "event_logs_event_type_idx" ON "event_logs"("event_type");

CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "source" text NOT NULL,
  "event_type" text NOT NULL,
  "debtor_id" text,
  "matter_id" text,
  "raw_payload" jsonb NOT NULL,
  "signature" text,
  "signature_valid" boolean DEFAULT false NOT NULL,
  "processed" boolean DEFAULT false NOT NULL,
  "processed_at" timestamp with time zone,
  "process_error" text,
  "idempotency_key" text UNIQUE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_decisions" (
  "id" text PRIMARY KEY NOT NULL,
  "matter_id" text NOT NULL,
  "debtor_id" text,
  "decision_type" text NOT NULL,
  "prompt" text NOT NULL,
  "prompt_version" text NOT NULL,
  "ai_provider" text NOT NULL,
  "ai_model" text NOT NULL,
  "input" jsonb NOT NULL,
  "output" jsonb NOT NULL,
  "confidence" numeric(3, 2),
  "approved" boolean,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "execution_time" numeric,
  "tokens_used" text,
  "hallucination" text,
  "reasoning" text,
  "action_taken" text,
  "outcome" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "scheduled_actions" (
  "id" text PRIMARY KEY NOT NULL,
  "matter_id" text NOT NULL,
  "debtor_id" text,
  "action_type" text NOT NULL,
  "action_payload" jsonb NOT NULL,
  "scheduled_for" timestamp with time zone NOT NULL,
  "priority" text DEFAULT 'NORMAL' NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "executed_at" timestamp with time zone,
  "execution_error" text,
  "retry_count" integer DEFAULT 0,
  "max_retries" integer DEFAULT 3,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Phase 2: Schema Enhancements for Full Automation
-- Migration: Add multi-user assignment, auto-advance rules, bot state tracking, and soft deletes

-- Add soft delete field to existing tables
ALTER TABLE "matters" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;
ALTER TABLE "debtors" ADD COLUMN "is_archived" boolean DEFAULT false NOT NULL;

-- Create matter_assignees table for multi-user assignment
CREATE TABLE "matter_assignees" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'COLLECTOR',
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by_id" text NOT NULL,
	"unassigned_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint

-- Create auto_advance_rules table for stage advancement automation
CREATE TABLE "auto_advance_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"from_stage" text NOT NULL,
	"to_stage" text NOT NULL,
	"condition_days" integer NOT NULL,
	"condition" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create bot_conversation_states table for WhatsApp bot memory
CREATE TABLE "bot_conversation_states" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text NOT NULL UNIQUE,
	"debtor_id" text NOT NULL,
	"state" text DEFAULT 'INITIAL' NOT NULL,
	"context" text,
	"last_message_at" timestamp with time zone,
	"last_bot_message_at" timestamp with time zone,
	"message_count" text DEFAULT '0',
	"escalation_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Create indexes for performance
CREATE INDEX "matter_assignees_matter_id_idx" ON "matter_assignees"("matter_id");
CREATE INDEX "matter_assignees_user_id_idx" ON "matter_assignees"("user_id");
CREATE INDEX "bot_conversation_states_matter_id_idx" ON "bot_conversation_states"("matter_id");
CREATE INDEX "auto_advance_rules_from_stage_idx" ON "auto_advance_rules"("from_stage");
CREATE INDEX "auto_advance_rules_enabled_idx" ON "auto_advance_rules"("enabled");

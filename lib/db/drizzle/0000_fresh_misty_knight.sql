CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'COLLECTOR' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "managing_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schemes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"agent_id" text NOT NULL,
	"address" text,
	"levy_amount" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "debtors" (
	"id" text PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"id_number" text,
	"company_name" text,
	"email" text,
	"phone" text,
	"whatsapp" text,
	"physical_address" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matter_counters" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matters" (
	"id" text PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"debtor_id" text NOT NULL,
	"scheme_id" text NOT NULL,
	"unit" text NOT NULL,
	"stage" text DEFAULT 'LOD' NOT NULL,
	"priority" text DEFAULT 'MEDIUM' NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"capital_arrears" numeric(12, 2) DEFAULT '0' NOT NULL,
	"interest" numeric(12, 2) DEFAULT '0' NOT NULL,
	"legal_costs" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_paid" numeric(12, 2) DEFAULT '0' NOT NULL,
	"interest_from_date" timestamp with time zone,
	"lod_date" timestamp with time zone,
	"s129_date" timestamp with time zone,
	"summons_date" timestamp with time zone,
	"judgment_date" timestamp with time zone,
	"writ_date" timestamp with time zone,
	"sale_date" timestamp with time zone,
	"assigned_to_id" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "matters_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text NOT NULL,
	"doc_type" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"generated_by_id" text NOT NULL,
	"sent_via" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" text NOT NULL,
	"received_date" timestamp with time zone NOT NULL,
	"allocated_to" text,
	"receipted_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"due_date" timestamp with time zone,
	"assignee_id" text NOT NULL,
	"is_auto_gen" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	"completion_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"old_data" text,
	"new_data" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stage_history" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text NOT NULL,
	"from_stage" text,
	"to_stage" text NOT NULL,
	"changed_by_id" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interest_rates" (
	"id" text PRIMARY KEY NOT NULL,
	"rate" numeric(5, 4) NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise_to_pay" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text NOT NULL,
	"first_payment_date" timestamp with time zone NOT NULL,
	"first_payment_amount" numeric(12, 2) NOT NULL,
	"installment_day" text NOT NULL,
	"installment_amount" numeric(12, 2) NOT NULL,
	"promise_date" timestamp with time zone NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posting_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'UNBILLED' NOT NULL,
	"description" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posting_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"transaction_type" text NOT NULL,
	"posting_code_id" text,
	"description" text,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creditors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"account_number" text,
	"contact" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_requisitions" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text,
	"pay_by_date" timestamp with time zone,
	"pay_from" text,
	"trust_bank_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communications" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text,
	"to" text NOT NULL,
	"channel" text NOT NULL,
	"template_id" text,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "whatsapp_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"matter_id" text,
	"debtor_id" text,
	"direction" text NOT NULL,
	"message_type" text,
	"content" text,
	"wa_message_id" text,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"error_msg" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

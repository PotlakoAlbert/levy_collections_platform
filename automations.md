BAM Levy Collection Platform — Complete Autonomous AI Build Prompt
This document provides a comprehensive, step-by-step guide to build a fully autonomous debt collection law firm management system. It replaces GhostPractice and runs on an “AI agent to AI agent” architecture—attorneys, admins, and managing agents only view dashboards and approve a few high-stake decisions. All code is modular, follows best practices, and uses free/open-source AI services to eliminate licensing costs.

Table of Contents
System Overview & Philosophy

Technology Stack

Core Requirements & Data Model

Phase 1 – Project Scaffolding & Base Platform

Phase 2 – Enhanced Data Model & UI Features

Phase 3 – WhatsApp Bot Engine & Communication Hub

Phase 4 – Autonomous AI Agents (DeepSeek/Gemini)

Phase 5 – Full Automation Scheduler & Workers

Phase 6 – Reports, Dashboards & Agent View

Phase 7 – Archiving, History & Compliance

Deployment & Verification

Every step is atomic, verifiable, and must be completed in order. No code is deleted—only archived. All history is fully traceable.

1. System Overview & Philosophy
The platform automates the entire levy collection lifecycle. Once a matter is opened, the system:

Sends a Letter of Demand (LOD) via WhatsApp/email/post immediately.

Negotiates payment plans with debtors 24/7 using a free AI chatbot.

Auto‑generates and dispatches legal documents at each stage.

Recommends stage advancement and auto‑advances when safe.

Calculates interest nightly, sends payment reminders, flags prescription risks.

Produces weekly reports for managing agents without human intervention.

Allows multiple users to be assigned to a matter.

Supports two types of closed matters (settled / written off).

Keeps a full, non‑destructive archive of all clients, schemes, and communications.

Attorneys only touch matters that require legal judgment—disputes, final sale approvals, arrangement approvals, court appearances.

2. Technology Stack
Layer	Technology
Frontend	Next.js 14 (App Router), React, TypeScript, Tailwind CSS
UI Components	shadcn/ui (Radix + Tailwind), @dnd-kit for drag‑and‑drop
State Management	Zustand (client), React Query + tRPC (server state)
Backend API	tRPC (type‑safe)
Database ORM	Prisma (PostgreSQL)
Authentication	NextAuth (credentials + JWT)
Job Queues	BullMQ + Redis (Upstash free tier)
File Storage	Cloudflare R2 (or S3‑compatible; free tier)
WhatsApp API	Meta WhatsApp Cloud API (free for first 1000 conversations/month)
Email	Resend (100 emails/day free)
AI (FREE)	DeepSeek API (OpenAI‑compatible, cheap) or Gemini API (free tier)
Document Generation	docxtemplater (for templates) + AI drafting via free API
Scheduling	node‑cron + Vercel Cron (or Railway workers)
Soft Deletes	deletedAt / isArchived fields – no hard deletes
3. Core Requirements & Data Model
All original requirements are embedded into the schema with these key enhancements:

3.1 Two Types of Closed Matters
The MatterStatus enum gains two closing types:

prisma
enum MatterStatus {
  ACTIVE
  ON_HOLD
  CLOSED_SETTLED       // paid in full, settlement reached
  CLOSED_WRITTEN_OFF   // irrecoverable, prescribed, etc.
}
When a matter is closed the closedReason field stores the justification.

3.2 Multiple Users per Matter
The assignedToId single foreign key is replaced by a many‑to‑many:

prisma
model MatterAssignee {
  matterId  String
  userId    String
  matter    Matter @relation(fields: [matterId], references: [id])
  user      User   @relation(fields: [userId], references: [id])
  assignedAt DateTime @default(now())
  @@id([matterId, userId])
}
3.3 Communication Hub
All communications (letters, emails, WhatsApp, post) are logged centrally:

prisma
model Communication {
  id           String   @id @default(cuid())
  matterId     String
  direction    MessageDirection
  channel      String   // WHATSAPP, EMAIL, POST, PHONE
  subject      String?
  body         String?
  waMessageId  String?  // for WhatsApp
  emailMessageId String? // for email
  trackingNumber String? // for post
  status       MessageStatus
  sentAt       DateTime?
  deliveredAt  DateTime?
  readAt       DateTime?
  createdAt    DateTime @default(now())
  matter       Matter   @relation(fields: [matterId], references: [id])
}
All WhatsApp, email, and postal history is shown in one unified timeline per matter.

3.4 Client (Scheme) Enhancements
Scheme renamed to Client (or keep Scheme but add ClientContact).

Client model includes fields for multiple contacts (trustees, managing agents):

prisma
model ClientContact {
  id        String   @id @default(cuid())
  clientId  String
  name      String
  role      String
  email     String?
  phone     String?
  client    Client   @relation(fields: [clientId], references: [id])
}
Clients can be archived (soft delete with isArchived).

Agent view (client view) shows only that client’s matters.

3.5 Diary & Tasks Enhancements
Calendar view using a library like react‑big‑calendar.

Ability to add own tasks (not auto‑generated).

Full task history (completed tasks remain visible).

Drag tasks to reschedule (change due date).

3.6 Reports & Dashboards
Live dashboard with monthly collection filters.

Reports per client, per month, matters per client per month.

Managing Agent Portal: dedicated view showing only their schemes/matters.

3.7 Archive Only, Nothing Deleted
Every major entity has an isArchived / deletedAt field. Queries default to filtering out archived records unless explicitly viewing archive.

4. Phase 1 – Project Scaffolding & Base Platform
Start with the original Phase 1 guide (Steps 1‑33) but with the following modifications to incorporate the above requirements from the beginning.

Step 1 – Create Next.js Project
(Same as original but ensure version 14.)

Step 2 – Install Dependencies
Add the following to the original list:

deepseek or openai (for DeepSeek API): npm install openai

@google/generative-ai (optional, if using Gemini)

react-big-calendar and moment for calendar: npm install react-big-calendar moment

cmdk for command palette (optional)

Everything else as in original.

Step 3 – Prisma Schema (Full Replacement)
Replace the entire schema.prisma with the one below. It merges the original schema + automation + all new requirements (multiple users, communications, closed types, client contacts, soft deletes).

prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── ENUMS ──
enum UserRole { ADMIN ATTORNEY COLLECTOR AGENT_VIEWER }

enum MatterStage { LOD S129 SUMMONS JUDGMENT WRIT RULE46 SALE CLOSED }

enum MatterPriority { LOW MEDIUM HIGH CRITICAL }

enum MatterStatus {
  ACTIVE
  ON_HOLD
  CLOSED_SETTLED
  CLOSED_WRITTEN_OFF
}

enum DebtorStatus { ACTIVE PAYING DEFAULTING ABSCONDED DECEASED }

enum TaskStatus { PENDING IN_PROGRESS COMPLETED CANCELLED OVERDUE }
enum TaskPriority { LOW NORMAL HIGH URGENT }

enum PaymentMethod { EFT CASH CARD DEBIT_ORDER SHERIFF OTHER }

enum DocumentType {
  LOD S129_NOTICE SUMMONS DEFAULT_JUDGMENT WRIT RULE46_NOTICE
  JOINDER_NOTICE PAYMENT_ARRANGEMENT STATEMENT CORRESPONDENCE OTHER
}

enum MessageDirection { INBOUND OUTBOUND }
enum MessageStatus { QUEUED SENT DELIVERED READ FAILED }
enum AuditAction { CREATE UPDATE DELETE STAGE_CHANGE PAYMENT DOCUMENT_GENERATED DOCUMENT_SENT LOGIN LOGOUT }

// ── MODELS ──
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  passwordHash  String    @map("password_hash")
  role          UserRole
  isActive      Boolean   @default(true) @map("is_active")
  lastLoginAt   DateTime? @map("last_login_at")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  matterAssignments MatterAssignee[]
  createdMatters    Matter[]        @relation("CreatedBy")
  tasks             Task[]          @relation("TaskAssignee")
  createdTasks      Task[]          @relation("TaskCreator")
  documents         Document[]
  payments          Payment[]
  notes             MatterNote[]
  stageChanges      StageHistory[]
  auditLogs         AuditLog[]
  agentLink         AgentUser?
  communications    Communication[]

  @@map("users")
}

model AgentUser {
  id      String       @id @default(cuid())
  userId  String       @unique @map("user_id")
  agentId String       @map("agent_id")
  user    User         @relation(fields: [userId], references: [id])
  agent   ManagingAgent @relation(fields: [agentId], references: [id])

  @@map("agent_users")
}

model ManagingAgent {
  id           String    @id @default(cuid())
  name         String
  contactName  String?   @map("contact_name")
  contactEmail String?   @map("contact_email")
  contactPhone String?   @map("contact_phone")
  address      String?
  isActive     Boolean   @default(true) @map("is_active")
  isArchived   Boolean   @default(false) @map("is_archived")
  createdAt    DateTime  @default(now()) @map("created_at")

  clients      Client[]
  agentUsers   AgentUser[]

  @@map("managing_agents")
}

model Client {
  id          String   @id @default(cuid())
  name        String
  schemeType  String?  @map("scheme_type")   // body_corporate, hoa, etc.
  agentId     String   @map("agent_id")
  address     String?
  levyAmount  Decimal? @map("levy_amount") @db.Decimal(10, 2)
  isActive    Boolean  @default(true) @map("is_active")
  isArchived  Boolean  @default(false) @map("is_archived")
  createdAt   DateTime @default(now()) @map("created_at")

  agent        ManagingAgent    @relation(fields: [agentId], references: [id])
  matters      Matter[]
  contacts     ClientContact[]

  @@map("clients")
}

model ClientContact {
  id        String   @id @default(cuid())
  clientId  String   @map("client_id")
  name      String
  role      String   // e.g. "Trustee", "Chairperson"
  email     String?
  phone     String?
  client    Client   @relation(fields: [clientId], references: [id])

  @@map("client_contacts")
}

model Debtor {
  id              String       @id @default(cuid())
  firstName       String       @map("first_name")
  lastName        String       @map("last_name")
  idNumber        String?      @map("id_number")
  companyName     String?      @map("company_name")
  companyRegNo    String?      @map("company_reg_no")
  email           String?
  phone           String?
  whatsapp        String?
  physicalAddress String?      @map("physical_address")
  postalAddress   String?      @map("postal_address")
  status          DebtorStatus @default(ACTIVE)
  notes           String?
  isArchived      Boolean      @default(false) @map("is_archived")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  matters          Matter[]
  communications   Communication[]
  agreements       PaymentAgreement[]

  @@index([lastName, firstName])
  @@index([idNumber])
  @@map("debtors")
}

model Matter {
  id         String         @id @default(cuid())
  reference String         @unique
  debtorId   String         @map("debtor_id")
  clientId   String         @map("client_id")
  unit       String
  stage      MatterStage    @default(LOD)
  priority   MatterPriority @default(MEDIUM)
  status     MatterStatus   @default(ACTIVE)

  capitalArrears  Decimal @default(0) @map("capital_arrears") @db.Decimal(12, 2)
  interest        Decimal @default(0) @db.Decimal(12, 2)
  legalCosts      Decimal @default(0) @map("legal_costs") @db.Decimal(12, 2)
  collectionComm  Decimal @default(0) @map("collection_comm") @db.Decimal(12, 2)
  totalPaid       Decimal @default(0) @map("total_paid") @db.Decimal(12, 2)

  interestRate     Decimal?  @map("interest_rate") @db.Decimal(5, 2)
  interestFromDate DateTime? @map("interest_from_date")

  lodDate          DateTime? @map("lod_date")
  s129Date         DateTime? @map("s129_date")
  summonsDate      DateTime? @map("summons_date")
  judgmentDate     DateTime? @map("judgment_date")
  writDate         DateTime? @map("writ_date")
  saleDate         DateTime? @map("sale_date")
  prescriptionDate DateTime? @map("prescription_date")

  nextAction    String?   @map("next_action")
  nextActionDue DateTime? @map("next_action_due")
  courtName     String?   @map("court_name")
  caseNumber    String?   @map("case_number")
  sheriffRef    String?   @map("sheriff_ref")

  createdById  String  @map("created_by_id")

  closedAt     DateTime? @map("closed_at")
  closedReason String?   @map("closed_reason")
  isArchived   Boolean   @default(false) @map("is_archived")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  debtor           Debtor           @relation(fields: [debtorId], references: [id])
  client           Client           @relation(fields: [clientId], references: [id])
  createdBy        User             @relation("CreatedBy", fields: [createdById], references: [id])
  assignees        MatterAssignee[]
  stageHistory     StageHistory[]
  documents        Document[]
  tasks            Task[]
  payments         Payment[]
  notes            MatterNote[]
  communications   Communication[]
  agreements       PaymentAgreement[]

  @@index([stage])
  @@index([status])
  @@index([debtorId])
  @@index([clientId])
  @@index([priority])
  @@index([nextActionDue])
  @@map("matters")
}

model MatterAssignee {
  matterId   String
  userId     String
  matter     Matter @relation(fields: [matterId], references: [id])
  user       User   @relation(fields: [userId], references: [id])
  assignedAt DateTime @default(now())
  @@id([matterId, userId])
  @@map("matter_assignees")
}

model StageHistory {
  id          String      @id @default(cuid())
  matterId    String      @map("matter_id")
  fromStage   MatterStage? @map("from_stage")
  toStage     MatterStage @map("to_stage")
  changedById String      @map("changed_by_id")
  notes       String?
  createdAt   DateTime    @default(now()) @map("created_at")

  matter    Matter @relation(fields: [matterId], references: [id])
  changedBy User   @relation(fields: [changedById], references: [id])
  @@index([matterId])
  @@map("stage_history")
}

model Task {
  id          String       @id @default(cuid())
  matterId    String?      @map("matter_id")
  title       String
  description String?
  status      TaskStatus   @default(PENDING)
  priority    TaskPriority @default(NORMAL)
  dueDate     DateTime?    @map("due_date")
  completedAt DateTime?    @map("completed_at")
  assigneeId  String       @map("assignee_id")
  createdById String       @map("created_by_id")
  isAutoGen   Boolean      @default(false) @map("is_auto_generated")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  matter    Matter? @relation(fields: [matterId], references: [id])
  assignee  User    @relation("TaskAssignee", fields: [assigneeId], references: [id])
  createdBy User    @relation("TaskCreator", fields: [createdById], references: [id])

  @@index([assigneeId, status])
  @@index([dueDate])
  @@index([matterId])
  @@map("tasks")
}

model MatterNote {
  id        String   @id @default(cuid())
  matterId  String   @map("matter_id")
  authorId  String   @map("author_id")
  content   String
  isPinned  Boolean  @default(false) @map("is_pinned")
  createdAt DateTime @default(now()) @map("created_at")

  matter Matter @relation(fields: [matterId], references: [id])
  author User   @relation(fields: [authorId], references: [id])
  @@index([matterId])
  @@map("matter_notes")
}

model Payment {
  id            String        @id @default(cuid())
  matterId      String        @map("matter_id")
  amount        Decimal       @db.Decimal(12, 2)
  method        PaymentMethod
  reference     String?
  receivedDate  DateTime      @map("received_date")
  allocatedTo   String?       @map("allocated_to")
  notes         String?
  receiptedById String        @map("receipted_by_id")
  createdAt     DateTime      @default(now()) @map("created_at")

  matter      Matter @relation(fields: [matterId], references: [id])
  receiptedBy User   @relation(fields: [receiptedById], references: [id])
  @@index([matterId])
  @@map("payments")
}

model Document {
  id            String       @id @default(cuid())
  matterId      String       @map("matter_id")
  docType       DocumentType @map("doc_type")
  fileName      String       @map("file_name")
  fileUrl       String       @map("file_url")
  fileSize      Int?         @map("file_size")
  generatedById String       @map("generated_by_id")
  sentVia       String?      @map("sent_via")
  sentAt        DateTime?    @map("sent_at")
  createdAt     DateTime     @default(now()) @map("created_at")

  matter      Matter @relation(fields: [matterId], references: [id])
  generatedBy User   @relation(fields: [generatedById], references: [id])
  @@index([matterId])
  @@map("documents")
}

model Communication {
  id             String         @id @default(cuid())
  matterId       String         @map("matter_id")
  direction      MessageDirection
  channel        String         // WHATSAPP, EMAIL, POST, PHONE
  subject        String?
  body           String?
  waMessageId    String?        @map("wa_message_id")
  emailMessageId String?        @map("email_message_id")
  trackingNumber String?        @map("tracking_number")
  status         MessageStatus  @default(QUEUED)
  sentAt         DateTime?      @map("sent_at")
  deliveredAt    DateTime?      @map("delivered_at")
  readAt         DateTime?      @map("read_at")
  errorMsg       String?        @map("error_msg")
  createdAt      DateTime       @default(now()) @map("created_at")

  matter   Matter @relation(fields: [matterId], references: [id])
  senderId String? @map("sender_id") // User if outbound, null if system
  sender   User?  @relation(fields: [senderId], references: [id])

  @@index([matterId])
  @@map("communications")
}

model PaymentAgreement {
  id            String   @id @default(cuid())
  matterId      String   @map("matter_id")
  debtorId      String   @map("debtor_id")
  totalAmount   Decimal  @map("total_amount") @db.Decimal(12, 2)
  monthlyAmount Decimal? @map("monthly_amount") @db.Decimal(12, 2)
  numberOfTerms Int?     @map("number_of_terms")
  startDate     DateTime? @map("start_date")
  endDate       DateTime? @map("end_date")
  terms         Json?
  status        String   @default("pending")   // pending, approved, rejected, active, completed
  approvedById  String?  @map("approved_by_id")
  approvedAt    DateTime? @map("approved_at")
  createdAt     DateTime @default(now()) @map("created_at")

  matter Matter @relation(fields: [matterId], references: [id])
  debtor Debtor @relation(fields: [debtorId], references: [id])

  @@index([matterId])
  @@map("payment_agreements")
}

model InterestRate {
  id            String    @id @default(cuid())
  rate          Decimal   @db.Decimal(5, 2)
  effectiveFrom DateTime  @map("effective_from")
  effectiveTo   DateTime? @map("effective_to")
  rateType      String    @map("rate_type")
  description   String?
  createdAt     DateTime  @default(now()) @map("created_at")
  @@map("interest_rates")
}

model AuditLog {
  id         String      @id @default(cuid())
  userId     String?     @map("user_id")
  action     AuditAction
  entityType String      @map("entity_type")
  entityId   String?     @map("entity_id")
  oldData    Json?       @map("old_data")
  newData    Json?       @map("new_data")
  ipAddress  String?     @map("ip_address")
  createdAt  DateTime    @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id])
  @@index([entityType, entityId])
  @@index([userId])
  @@index([createdAt])
  @@map("audit_log")
}

model SystemSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("system_settings")
}
Note: Every model that can be archived includes isArchived boolean. All queries must filter isArchived: false by default.

Step 4 – .env (Add Free AI API Keys)
env
# Use DeepSeek API (free credits/new account)
DEEPSEEK_API_KEY="sk-..."
DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
AI_MODEL="deepseek-chat"  # or deepseek-coder
For Gemini, you would use GEMINI_API_KEY and the corresponding library.

Continue through the original Steps 5–33 – but always adjust any reference to scheme to client, and replace assignedToId with the new many-to-many assignments table.
Detailed modifications for these steps:

In src/server/modules/matters/matters.router.ts, the create mutation must accept assigneeIds: z.array(z.string()) and create MatterAssignee records.

The matter list page must show all assignees (comma-separated).

When creating a matter, the debtors search and client (scheme) selection remain, but now you can assign multiple users.

The advanceStage auto‑task assignment defaults to the first assignee; you may create tasks for all.

After completing Phase 1, you have a fully working core system with the new data model.

5. Phase 2 – Enhanced Data Model & UI Features
5.1 – Matter Pipeline with Drag‑and‑Drop (Kanban)
Build a pipeline board src/components/pipeline/PipelineBoard.tsx using @dnd-kit/core.

Each lane is a MatterStage. Cards show reference, debtor, amount, assignees.

Bulk drag: allow selecting multiple cards (via checkboxes) and dragging them together to another lane.

On drop, call api.matters.bulkAdvanceStage (new tRPC mutation) that loops through selected matters and advances each.

5.2 – Communication Timeline
On the matter detail page, create a tab/panel “Communications”.

Fetch all Communication records for the matter, ordered by date.

Display with channel icon (WhatsApp, email, post) and content. Show sent/delivered/read status.

Add a button “Log Communication” to manually record a phone call or letter posted (with tracking number).

5.3 – Document Enhancements
Documents list filters: filter by docType (stage-specific).

Bulk generate by stage: A button on the documents page allows selecting a stage and bulk generating (e.g., “Generate LOD for all LOD matters”).

The generation uses AI (DeepSeek) to draft content (see Phase 4).

5.4 – Enhanced Diary
Page: /dashboard/diary.

Add toggle between List view and Calendar view.

Calendar view uses react-big-calendar to show tasks by due date.

“Add Task” button creates a manual task (not auto‑generated).

Past tasks are kept in history; they can be filtered by status.

Drag a task in calendar to change its due date (use onEventDrop).

5.5 – Client (Scheme) Portal
Rename all “Schemes” UI to “Clients”.

Under a client detail page, list all client contacts (trustees) and allow management.

Archiving: toggle isArchived. Archived clients disappear from active lists but are accessible under “Archived Clients” with their full history.

Managing Agents can only see their own clients via the Agent Portal (Phase 6).

5.6 – Multiple User Assignment UI
In the matter form and detail, allow selecting multiple users from a dropdown.

Show assigned users as avatars/names.

6. Phase 3 – WhatsApp Bot Engine & Communication Hub
We now layer the free WhatsApp automation and bot, using DeepSeek for AI.

6.1 – WhatsApp Business Setup
Create a Meta developer app, add WhatsApp product.

Get permanent access token, phone number ID.

Register templates (as original Automation guide Step A-3) – use the same 5 templates.

Webhook URL: https://yourdomain.com/api/whatsapp/webhook

6.2 – WhatsApp Service (Adapt from original A-4)
Use axios to send text, template, and document messages.

Store all messages in Communication table (channel = "WHATSAPP").

6.3 – WhatsApp Webhook
src/app/api/whatsapp/webhook/route.ts – the same logic but now writing to Communication.

Inbound messages go to the bot engine.

6.4 – Bot Engine (Modified for Free AI)
The bot (src/server/modules/whatsapp/bot/bot.engine.ts) uses the same intent classification and negotiation logic, but calls DeepSeek API instead of Anthropic.

Use openai npm package with DeepSeek’s base URL:

typescript
import OpenAI from "openai";
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL,
});
// Then call deepseek.chat.completions.create({ model: "deepseek-chat", messages: [...] })
Replace all anthropic.messages.create with the DeepSeek equivalent; the prompt structure is similar (JSON instructions). Ensure the response format is JSON.

Bot state is stored in SystemSetting (or Redis) as before.

6.5 – Unified Communication Sending
Whenever a stage advances or document is generated, automatically log a Communication record (channel "WHATSAPP", "EMAIL", or "POST") and send the real message.

7. Phase 4 – Autonomous AI Agents (Free)
Replace every paid AI call in the Automation guide (Step A-6) with DeepSeek (or Gemini). The functions remain almost identical, only the library changes.

7.1 – AI Service (src/server/modules/ai/ai.service.ts)
classifyDebtorIntent – uses DeepSeek to classify WhatsApp messages.

recommendStageAdvancement – uses DeepSeek to recommend next stage.

scoreDebtorRisk – returns risk score.

draftDocumentContent – drafts letter content for any document type.

generatePaymentArrangement – negotiates terms.

All these use deepseek.chat.completions.create with system prompts instructing strict JSON output. The prompt engineering is identical to the original.

7.2 – AI Worker (src/server/jobs/workers/ai.worker.ts)
Process AI jobs from BullMQ (risk scoring, stage recommendations).

Same as original but using DeepSeek.

7.3 – AI Dashboard Features
The AIAdvisor component in matter detail works unchanged; it calls /api/ai/recommend.

The bulk analysis button works.

8. Phase 5 – Full Automation Scheduler & Workers
8.1 – Queue Setup
Same BullMQ setup as Step A-2, but ensure Redis URL uses Upstash free Redis.

Workers: whatsapp, documents, ai, interest, reminders, reports, payments.

8.2 – Workers Implementation
All workers remain as in Steps A-9, but they now use the Communication table for messages and DeepSeek for AI.

Interest worker recalculates interest using calculateMatterInterest (unchanged).

Reminder worker sends payment reminders.

Reports worker sends weekly emails via Resend.

8.3 – Cron Scheduler
Use node-cron or Vercel Cron.

Nightly interest recalc, overdue tasks, prescription warnings.

Weekday payment reminders.

Weekly agent reports.

8.4 – Automation Triggers (Event Hooks)
onMatterCreated, onStageChanged, onPaymentReceived (Step A-8) now create Communication records and enqueue jobs.

9. Phase 6 – Reports, Dashboards & Agent View
9.1 – Enhanced Main Dashboard
Add filter: select month/year to see collections for that period.

Show graph (using Recharts) of monthly collections.

9.2 – Agent Viewer (Client Portal)
A separate login or role‑based dashboard that shows only the matters belonging to the managing agent’s clients.

Agent can view their clients, open matters, stage pipeline, and receive weekly reports.

Agents cannot perform legal actions; they only view and approve payment arrangements.

9.3 – Reports Page
Matters per client (per month): group by client and month.

Detailed aged debtors by client filter.

Collection success rate.

All reports are exportable (CSV/Excel) and can be scheduled via email.

10. Phase 7 – Archiving, History & Compliance
Every entity now has isArchived; provide UI to archive/unarchive.

History is retained indefinitely: stage history, notes, tasks, communications.

“Closed matters” filtered by type (settled vs. written off).

Audit trail logs every action.

Deletion is strictly prohibited – buttons marked “Archive” instead.

11. Deployment & Verification
Database: Provision a PostgreSQL database (Supabase/Neon free tier). Run prisma migrate dev.

Redis: Create Upstash Redis free instance, add REDIS_URL.

AI API: Get DeepSeek API key (sign up for free credits) or Gemini key.

Storage: Set up Cloudflare R2 or equivalent.

Workers: Deploy a separate Node.js process on Railway (free tier) using the worker starter script.

Web: Deploy Next.js on Vercel / Railway.

Environment: Set all env vars.

Run seed: Create admin user, test debtor, system user.

Full UAT: Follow the 10 test scenarios from Step A-20 (but now using DeepSeek and the communication hub). Verify auto‑close, bot negotiation, stage advancement, report emails.
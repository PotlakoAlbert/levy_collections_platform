# BL-PMS: Staged Agent Prompts
## Bam Law Practice Management System — Phase-by-Phase Build Guide

> Hand each stage to your code agent **one at a time**.
> Only move to the next stage after the agent confirms the current stage builds and runs without errors.
> Each prompt is **self-contained** — it tells the agent exactly what exists, what to build, and how to verify.

---

## MASTER CONTEXT (Read before every stage)

> Paste this block at the top of **every single stage prompt** so the agent never loses context.

```
MASTER CONTEXT — BAM LAW PRACTICE MANAGEMENT SYSTEM (BL-PMS)

You are building a single-firm legal ERP for Bam Law, a South African levy collection law firm.
This is NOT a SaaS. There are no tenants. All data belongs to one firm.

Core philosophy:
- Matter-centric: every feature (contacts, documents, tasks, payments) links to a Matter.
- Financial-first: full trust + business accounting built in.
- Workflow-driven: stage advancement auto-generates tasks and documents.
- Single firm: no tenantId, no org switching, no multi-tenant logic.

Tech stack (do not deviate):
- Next.js 15 (App Router), TypeScript (strict), Tailwind CSS, shadcn/ui
- tRPC v10 with superjson transformer
- PostgreSQL via Neon (free tier), Prisma ORM v5
- NextAuth.js v5 (credentials provider)
- Cloudflare R2 for file storage
- docxtemplater + pizzip for DOCX generation
- Inngest for background jobs
- OpenAI API (mock if key missing)
- WhatsApp Business API (mock for dev)

Design system:
- Colour palette: deep navy (#1e3a8a), slate (#475569), gold accent (#d4af37), white bg
- Fonts: DM Sans (headings) + IBM Plex Mono (financial numbers) + Lora (body text)
- shadcn/ui components as base, customised with Tailwind
- Dark mode via next-themes
- Responsive: works at 320px width minimum
```

---

---

# STAGE 1 — Project Scaffolding, Database Schema & Authentication

## What you are building in this stage
The complete project skeleton: Next.js app, full Prisma schema, database connection, and a working login/logout with role-based access control.

## Pre-conditions
Nothing exists yet. Start from zero.

---

## PROMPT FOR AGENT — STAGE 1

```
MASTER CONTEXT (paste from above)

---

STAGE 1 GOAL: Scaffold the project, define the complete database schema, and implement working authentication.

STEP 1 — Create the Next.js project

Run:
  npx create-next-app@latest bam-law-pms --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

Then install all required dependencies:
  npm install @prisma/client prisma
  npm install @trpc/server @trpc/client @trpc/react-query @trpc/next @tanstack/react-query superjson zod
  npm install next-auth@beta @auth/prisma-adapter
  npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
  npm install bcryptjs @types/bcryptjs
  npm install next-themes
  npm install lucide-react class-variance-authority clsx tailwind-merge
  npx shadcn@latest init
  npx shadcn@latest add button input label card dialog form select textarea badge avatar separator tabs toast dropdown-menu sheet skeleton

STEP 2 — Create the .env.local file with these keys:
  DATABASE_URL="postgresql://..."           # Neon connection string
  NEXTAUTH_URL="http://localhost:3000"
  NEXTAUTH_SECRET="replace_with_64_char_random_string"
  R2_ACCOUNT_ID=""
  R2_ACCESS_KEY_ID=""
  R2_SECRET_ACCESS_KEY=""
  R2_BUCKET_NAME="bam-documents"
  WHATSAPP_PHONE_NUMBER_ID=""
  WHATSAPP_ACCESS_TOKEN=""
  WHATSAPP_WEBHOOK_VERIFY_TOKEN=""
  OPENAI_API_KEY=""
  RESEND_API_KEY=""

STEP 3 — Create the complete Prisma schema at prisma/schema.prisma

Use this EXACT schema, no deviations:

--- BEGIN SCHEMA ---

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ENUMS
enum UserRole {
  ADMIN
  ATTORNEY
  COLLECTOR
  AGENT_VIEWER
}

enum MatterType {
  LEVY_COLLECTION
  LITIGATION
  CONVEYANCING
  COMMERCIAL_CONTRACT
}

enum MatterStatus {
  DRAFT
  ACTIVE
  STAYED
  SETTLED
  CLOSED
  ARCHIVED
}

enum MatterStage {
  LOD
  S129
  SUMMONS
  JUDGMENT
  WRIT
  RULE46
  SALE
  CLOSED
}

enum MatterPriority {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

enum PartyType {
  INDIVIDUAL
  COMPANY
  TRUST
}

enum PartyRole {
  CLIENT
  DEBTOR
  RESPONDENT
  WITNESS
  OPPOSING_COUNSEL
  BANK
  SHERIFF
  EXPERT
}

enum AccountType {
  ASSET
  LIABILITY
  EQUITY
  REVENUE
  EXPENSE
}

enum DocumentType {
  LOD
  S129
  SUMMONS
  JUDGMENT
  WRIT
  RULE46
  CORRESPONDENCE
  INVOICE
  RECEIPT
  OTHER
}

enum TaskPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  CANCELLED
  OVERDUE
}

// MODELS

model User {
  id               String    @id @default(cuid())
  email            String    @unique
  name             String
  passwordHash     String
  role             UserRole  @default(COLLECTOR)
  isActive         Boolean   @default(true)
  twoFactorSecret  String?
  lastLoginAt      DateTime?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  assignedMatters        Matter[]           @relation("AssignedTo")
  tasks                  Task[]             @relation("TaskAssignee")
  createdTasks           Task[]             @relation("TaskCreator")
  documents              Document[]
  payments               Payment[]
  notes                  MatterNote[]
  stageChanges           StageHistory[]
  auditLogs              AuditLog[]
  ledgerTransactions     LedgerTransaction[]
  communications         Communication[]

  @@map("users")
}

model Department {
  id          String   @id @default(cuid())
  name        String   @unique
  description String?
  createdAt   DateTime @default(now())
  matters     Matter[]
  @@map("departments")
}

model ManagingAgent {
  id           String   @id @default(cuid())
  name         String
  contactName  String?
  contactEmail String?
  contactPhone String?
  address      String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  schemes      Scheme[]
  @@map("managing_agents")
}

model Scheme {
  id         String        @id @default(cuid())
  name       String
  schemeType String?
  agentId    String
  address    String?
  levyAmount Decimal?      @db.Decimal(10, 2)
  isActive   Boolean       @default(true)
  createdAt  DateTime      @default(now())
  agent      ManagingAgent @relation(fields: [agentId], references: [id])
  matters    Matter[]
  @@map("schemes")
}

model Matter {
  id                    String         @id @default(cuid())
  reference             String         @unique
  title                 String
  type                  MatterType     @default(LEVY_COLLECTION)
  status                MatterStatus   @default(DRAFT)
  stage                 MatterStage    @default(LOD)
  priority              MatterPriority @default(MEDIUM)
  riskScore             Decimal?       @db.Decimal(3, 2)
  responsibleAttorneyId String?
  teamIds               String[]
  departmentId          String?
  schemeId              String?
  openDate              DateTime       @default(now())
  closeDate             DateTime?
  prescriptionDate      DateTime?
  capitalArrears        Decimal        @default(0) @db.Decimal(12, 2)
  interest              Decimal        @default(0) @db.Decimal(12, 2)
  legalCosts            Decimal        @default(0) @db.Decimal(12, 2)
  totalPaid             Decimal        @default(0) @db.Decimal(12, 2)
  lodDate               DateTime?
  s129Date              DateTime?
  summonsDate           DateTime?
  judgmentDate          DateTime?
  writDate              DateTime?
  saleDate              DateTime?
  customFields          Json?
  version               Int            @default(1)
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt

  responsibleAttorney  User?          @relation("AssignedTo", fields: [responsibleAttorneyId], references: [id])
  department           Department?    @relation(fields: [departmentId], references: [id])
  scheme               Scheme?        @relation(fields: [schemeId], references: [id])
  parties              MatterParty[]
  stageHistory         StageHistory[]
  documents            Document[]
  tasks                Task[]
  payments             Payment[]
  notes                MatterNote[]
  ledgerTransactions   LedgerTransaction[]
  communications       Communication[]
  agreements           PaymentAgreement[]

  @@index([stage])
  @@index([status])
  @@index([responsibleAttorneyId])
  @@index([reference])
  @@map("matters")
}

model Party {
  id                      String      @id @default(cuid())
  type                    PartyType
  fullName                String?
  companyName             String?
  registrationNo          String?
  taxNo                   String?
  email                   String?
  phone                   String?
  mobile                  String?
  whatsapp                String?
  physicalAddress         Json?
  postalAddress           Json?
  bankDetails             Json?
  communicationPreferences Json?
  tags                    String[]
  customFields            Json?
  createdAt               DateTime    @default(now())
  updatedAt               DateTime    @updatedAt

  matters     MatterParty[]
  agreements  PaymentAgreement[]
  communications Communication[]

  @@index([registrationNo])
  @@index([email])
  @@map("parties")
}

model MatterParty {
  matterId  String
  partyId   String
  role      PartyRole
  isPrimary Boolean   @default(false)
  startDate DateTime  @default(now())
  endDate   DateTime?
  notes     String?

  matter    Matter    @relation(fields: [matterId], references: [id])
  party     Party     @relation(fields: [partyId], references: [id])

  @@id([matterId, partyId, role])
  @@index([matterId])
  @@index([partyId])
  @@map("matter_parties")
}

model LedgerAccount {
  id            String      @id
  code          String      @unique
  name          String
  type          AccountType
  category      String
  normalBalance String
  isActive      Boolean     @default(true)
  description   String?
  createdAt     DateTime    @default(now())
  entries       LedgerEntry[]
  @@map("ledger_accounts")
}

model LedgerTransaction {
  id          String   @id @default(cuid())
  matterId    String?
  description String
  date        DateTime
  reference   String?
  createdById String
  createdAt   DateTime @default(now())

  matter      Matter?       @relation(fields: [matterId], references: [id])
  createdBy   User          @relation(fields: [createdById], references: [id])
  entries     LedgerEntry[]

  @@index([matterId])
  @@index([date])
  @@map("ledger_transactions")
}

model LedgerEntry {
  id            String   @id @default(cuid())
  transactionId String
  accountId     String
  amount        Decimal  @db.Decimal(12, 2)
  direction     String
  matterId      String?

  transaction   LedgerTransaction @relation(fields: [transactionId], references: [id])
  account       LedgerAccount     @relation(fields: [accountId], references: [id])

  @@index([transactionId])
  @@index([accountId])
  @@index([matterId])
  @@map("ledger_entries")
}

model Payment {
  id            String   @id @default(cuid())
  matterId      String
  amount        Decimal  @db.Decimal(12, 2)
  method        String
  reference     String?
  receivedDate  DateTime
  allocatedTo   String?
  notes         String?
  receiptedById String
  createdAt     DateTime @default(now())

  matter        Matter   @relation(fields: [matterId], references: [id])
  receiptedBy   User     @relation(fields: [receiptedById], references: [id])

  @@index([matterId])
  @@map("payments")
}

model DocumentTemplate {
  id           String       @id @default(cuid())
  name         String
  type         DocumentType
  fileUrl      String
  placeholders String[]
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  documents    Document[]
  @@map("document_templates")
}

model Document {
  id                      String       @id @default(cuid())
  matterId                String
  name                    String
  type                    DocumentType
  version                 Int          @default(1)
  parentId                String?
  fileUrl                 String
  fileHash                String
  generatedFromTemplateId String?
  generatedBy             String
  sentVia                 String[]
  sentAt                  DateTime?
  openTrackingId          String?
  customMetadata          Json?
  createdAt               DateTime     @default(now())

  matter          Matter            @relation(fields: [matterId], references: [id])
  template        DocumentTemplate? @relation(fields: [generatedFromTemplateId], references: [id])
  generatedByUser User              @relation(fields: [generatedBy], references: [id])

  @@index([matterId])
  @@map("documents")
}

model Task {
  id                  String       @id @default(cuid())
  matterId            String?
  title               String
  description         String?
  priority            TaskPriority @default(NORMAL)
  status              TaskStatus   @default(PENDING)
  dueDate             DateTime?
  completedAt         DateTime?
  assigneeId          String
  createdBy           String
  isAutoGenerated     Boolean      @default(false)
  recurrenceRule      String?
  suggestedNextAction String?
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  matter   Matter? @relation(fields: [matterId], references: [id])
  assignee User    @relation("TaskAssignee", fields: [assigneeId], references: [id])
  creator  User    @relation("TaskCreator", fields: [createdBy], references: [id])

  @@index([assigneeId, status])
  @@index([dueDate])
  @@index([matterId])
  @@map("tasks")
}

model Communication {
  id          String   @id @default(cuid())
  matterId    String
  partyId     String?
  direction   String
  channel     String
  from        String
  to          String
  subject     String?
  body        String   @db.Text
  attachments String[]
  status      String
  externalId  String?
  readAt      DateTime?
  createdAt   DateTime @default(now())

  matter      Matter   @relation(fields: [matterId], references: [id])
  party       Party?   @relation(fields: [partyId], references: [id])

  @@index([matterId])
  @@index([channel, externalId])
  @@map("communications")
}

model StageHistory {
  id          String       @id @default(cuid())
  matterId    String
  fromStage   MatterStage?
  toStage     MatterStage
  changedById String
  notes       String?
  createdAt   DateTime     @default(now())

  matter      Matter       @relation(fields: [matterId], references: [id])
  changedBy   User         @relation(fields: [changedById], references: [id])

  @@index([matterId])
  @@map("stage_history")
}

model MatterNote {
  id        String   @id @default(cuid())
  matterId  String
  authorId  String
  content   String   @db.Text
  isPinned  Boolean  @default(false)
  createdAt DateTime @default(now())

  matter    Matter   @relation(fields: [matterId], references: [id])
  author    User     @relation(fields: [authorId], references: [id])

  @@index([matterId])
  @@map("matter_notes")
}

model PaymentAgreement {
  id            String   @id @default(cuid())
  matterId      String
  debtorId      String
  totalAmount   Decimal  @db.Decimal(12, 2)
  monthlyAmount Decimal? @db.Decimal(12, 2)
  numberOfTerms Int?
  startDate     DateTime?
  endDate       DateTime?
  terms         Json?
  status        String    @default("pending")
  approvedById  String?
  approvedAt    DateTime?
  createdAt     DateTime  @default(now())

  matter        Matter    @relation(fields: [matterId], references: [id])
  debtor        Party     @relation(fields: [debtorId], references: [id])

  @@index([matterId])
  @@map("payment_agreements")
}

model InterestRate {
  id            String    @id @default(cuid())
  rate          Decimal   @db.Decimal(5, 2)
  effectiveFrom DateTime
  effectiveTo   DateTime?
  rateType      String
  description   String?
  createdAt     DateTime  @default(now())
  @@map("interest_rates")
}

model AuditLog {
  id         String   @id @default(cuid())
  userId     String?
  action     String
  entityType String
  entityId   String?
  oldData    Json?
  newData    Json?
  ipAddress  String?
  createdAt  DateTime @default(now())

  user       User?    @relation(fields: [userId], references: [id])

  @@index([entityType, entityId])
  @@index([userId])
  @@index([createdAt])
  @@map("audit_logs")
}

model SystemSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
  @@map("system_settings")
}

--- END SCHEMA ---

STEP 4 — Run migrations
  npx prisma migrate dev --name init
  npx prisma generate

STEP 5 — Create src/lib/prisma.ts (singleton)
  Standard PrismaClient singleton with global caching for Next.js hot reload.

STEP 6 — Set up tRPC
  Create src/server/trpc.ts with:
  - createTRPCContext (reads session from NextAuth)
  - t = initTRPC.context<Context>().create({ transformer: superjson })
  - publicProcedure and protectedProcedure (throws UNAUTHORIZED if no session)
  - router export

  Create src/server/routers/_app.ts as the root router (empty for now, just set up the shape).

  Create src/app/api/trpc/[trpc]/route.ts as the Next.js App Router handler.

  Create src/trpc/client.ts and src/trpc/provider.tsx for client-side usage.

STEP 7 — Set up NextAuth v5
  Create auth.ts at the root using PrismaAdapter.
  Use CredentialsProvider:
  - Find user by email.
  - Compare password with bcryptjs.
  - Return user object with id, email, name, role.
  Include role in the JWT token and session.
  Create src/app/api/auth/[...nextauth]/route.ts handler.

STEP 8 — Create the login page
  Path: src/app/(auth)/login/page.tsx
  - Clean, professional login form using shadcn/ui Card, Input, Button.
  - Email + password fields.
  - Show error on invalid credentials.
  - On success, redirect to /dashboard.
  - Apply the firm's design system: navy background, gold accent button, DM Sans font.

STEP 9 — Create route protection middleware
  Create middleware.ts at root:
  - Redirect unauthenticated users to /login.
  - Redirect AGENT_VIEWER role to /portal (placeholder page is fine for now).

STEP 10 — Create the seed script at prisma/seed.ts

Create these records:
  Admin user:      admin@bam.co.za     / password: Admin@123  / role: ADMIN
  Attorney user:   attorney@bam.co.za  / password: Admin@123  / role: ATTORNEY
  Collector user:  collector@bam.co.za / password: Admin@123  / role: COLLECTOR

  One Managing Agent: name = "Trafalgar Property Services"
  One Scheme: name = "Windleigh House", agentId = above agent, levyAmount = 1500.00

  One Party (Debtor):
    type = INDIVIDUAL, fullName = "John Doe", registrationNo = "8001015009087"
    phone = "0821234567", whatsapp = "27821234567", email = "john.doe@email.com"
    physicalAddress = { street: "12 Main Street", city: "Johannesburg", postalCode: "2001" }

  One Matter:
    reference = "BAM-2026-0001", title = "Doe – Windleigh House", type = LEVY_COLLECTION
    status = ACTIVE, stage = LOD, priority = HIGH
    capitalArrears = 15000.00, legalCosts = 2500.00

  Link John Doe to the matter as DEBTOR (isPrimary = true).

  InterestRate: rate = 10.25, rateType = "prescribed", effectiveFrom = 2024-01-01

  Default LedgerAccounts (seed these):
    1001 | Trust Cash        | ASSET     | TRUST      | DEBIT
    1002 | Operating Cash    | ASSET     | OPERATING  | DEBIT
    2001 | Trust Liability   | LIABILITY | TRUST      | CREDIT
    4001 | Legal Fees        | REVENUE   | OPERATING  | CREDIT
    5001 | Disbursements     | EXPENSE   | OPERATING  | DEBIT

Add to package.json: "prisma": { "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts" }
Run: npx prisma db seed

STEP 11 — Add a basic placeholder dashboard page
  Path: src/app/(app)/dashboard/page.tsx
  - Just render: <h1>Welcome to Bam Law PMS</h1> with the session user's name.
  - Wrap in a minimal layout with the sidebar placeholder.

STEP 12 — Verify everything works
  Run: npm run dev
  Confirm:
  - http://localhost:3000 redirects to /login
  - Login with admin@bam.co.za / Admin@123 works
  - After login, /dashboard loads and shows user name
  - Run: npx tsc --noEmit (zero TypeScript errors)
  - Run: npm run build (must succeed)

DELIVERABLE FOR THIS STAGE:
- Working Next.js app
- Complete Prisma schema migrated to database
- Working login/logout
- Database seeded with sample data
- Zero TypeScript errors
- Successful production build

Do NOT build any other pages yet. Confirm all steps above are complete and working before stopping.
```

---

---

# STAGE 2 — App Shell, Navigation & Dashboard

## What you are building in this stage
The full application layout (sidebar, topbar, dark mode), the dashboard with live stats, and the global ⌘K search command palette.

## Pre-conditions
Stage 1 is complete: auth works, schema is migrated, seed is run.

---

## PROMPT FOR AGENT — STAGE 2

```
MASTER CONTEXT (paste from above)

WHAT IS ALREADY BUILT:
- Complete Next.js project with Prisma schema migrated
- NextAuth working (login/logout/session)
- Database seeded with admin, one matter, one debtor
- tRPC infrastructure in place

STAGE 2 GOAL: Build the full app shell and a live dashboard.

STEP 1 — Create the (app) layout at src/app/(app)/layout.tsx

This is the main authenticated layout. It must include:

Sidebar (left, fixed, 240px wide on desktop, collapsible to icon-only):
  - Firm logo at top: "BAM LAW" in gold (#d4af37), bold, DM Sans font
  - Navigation items with icons (lucide-react):
      Dashboard       → /dashboard         (LayoutDashboard icon)
      Matters         → /matters           (Briefcase icon)
      Debtors         → /debtors           (Users icon)
      My Diary        → /diary             (CalendarCheck icon)
      Schemes         → /schemes           (Building2 icon)
      Agents          → /agents            (Network icon)
      Reports         → /reports           (BarChart3 icon)
      Settings        → /settings          (Settings icon, bottom)
  - Active link highlighted with navy background + gold text
  - User avatar + name + role at sidebar bottom with logout button
  - On mobile: sidebar becomes a Sheet (drawer) triggered by hamburger icon

Top bar (right of sidebar):
  - Global search trigger button "Search... ⌘K" (opens command palette)
  - Dark mode toggle button (SunIcon / MoonIcon)
  - Notification bell (placeholder, badge count)
  - User dropdown (Profile, Settings, Logout)

Main content area: full-height, scrollable, padded

Apply design system:
  - Light mode: white sidebar with navy text, content area bg-slate-50
  - Dark mode: bg-slate-900 sidebar, bg-slate-950 content
  - Gold accent for active states and primary buttons
  - DM Sans for all UI text

STEP 2 — Implement dark mode
  Install: npm install next-themes
  Wrap app in ThemeProvider in src/app/layout.tsx
  The toggle button in the top bar must switch themes

STEP 3 — Build the global ⌘K search command palette
  Use shadcn/ui CommandDialog component.
  Trigger: clicking "Search ⌘K" button OR pressing Cmd+K / Ctrl+K
  
  The palette must search:
  - Matters (by reference, title, debtor name)
  - Debtors (by name, SA ID)
  
  Create the tRPC procedure: search.globalSearch(query: string)
    - Returns up to 5 matters and 5 debtors matching the query
    - Search matters on: reference, title (ILIKE)
    - Search parties on: fullName, companyName, registrationNo (ILIKE)
  
  Results show with icons:
  - Briefcase icon + reference + title for matters
  - User icon + name + ID for debtors
  
  Clicking a result navigates to /matters/[id] or /debtors/[id]

STEP 4 — Build the tRPC dashboard router

Create src/server/routers/dashboard.ts with procedure:
  getDashboardStats() → returns:
    - totalActiveMatters: count where status = ACTIVE
    - totalOutstanding: sum of (capitalArrears + interest + legalCosts - totalPaid)
    - overdueTasksCount: count of tasks where dueDate < now AND status = PENDING
    - mattersByStage: array of { stage, count, totalOutstanding }
    - recentMatters: last 5 matters (id, reference, title, stage, capitalArrears)
    - recentPayments: last 5 payments (id, amount, matterId, matterReference, receivedDate)
    - prescriptionWarnings: count of matters where prescriptionDate < (now + 90 days)

STEP 5 — Build the dashboard page at src/app/(app)/dashboard/page.tsx

Layout: grid of widgets using Tailwind CSS Grid

Widget 1 — Stats row (4 cards side by side):
  - Active Matters (count, briefcase icon, navy)
  - Total Outstanding (ZAR formatted, trend arrow, gold)
  - Overdue Tasks (count, warning icon, red if > 0)
  - Prescription Warnings (count, clock icon, amber if > 0)

Widget 2 — Pipeline Summary (horizontal bar or table):
  Show count and total outstanding per stage: LOD, S129, SUMMONS, JUDGMENT, WRIT, RULE46, SALE
  Each stage is a coloured badge with count

Widget 3 — Recent Matters (table):
  Columns: Reference | Title | Stage | Capital Arrears | Action (View button)
  Last 5 matters

Widget 4 — Recent Payments (list):
  Last 5 payments with matter reference, amount, date

Design requirements:
  - Stats cards use subtle shadow, rounded-xl, border
  - Numbers formatted as ZAR: "R 15,000.00"
  - Use Skeleton loading states while data loads
  - All cards are clickable and navigate to relevant list pages

STEP 6 — Register all routers in _app.ts
  Add dashboardRouter and searchRouter to the root appRouter.

STEP 7 — Verify
  Run npm run dev:
  - Sidebar shows on all /dashboard, collapses on mobile
  - Dark mode toggle works
  - Dashboard stats load from real database
  - ⌘K opens search palette and returns results
  - Run npx tsc --noEmit (zero errors)
  - Run npm run build (succeeds)

DELIVERABLE FOR THIS STAGE:
- Full app shell with sidebar and topbar
- Working dark mode
- Live dashboard with real stats from database
- Working ⌘K global search
- Zero TypeScript errors, successful build
```

---

---

# STAGE 3 — Matter Management (Full CRUD + Stage Advancement)

## What you are building in this stage
The complete Matters module: list page, create form, detail page with tabs, inline editing, and stage advancement with auto-task generation.

## Pre-conditions
Stages 1 and 2 are complete and working.

---

## PROMPT FOR AGENT — STAGE 3

```
MASTER CONTEXT (paste from above)

WHAT IS ALREADY BUILT:
- App shell, navigation, dark mode, dashboard, global search

STAGE 3 GOAL: Complete matter management — list, create, view, edit, and stage advancement.

STEP 1 — Create the matters tRPC router at src/server/routers/matters.ts

Procedures:

getAll(input: { stage?, status?, search?, assigneeId?, page?, pageSize? })
  - Filter by stage, status, assigneeId if provided
  - If search: filter by reference ILIKE or title ILIKE
  - Include: responsibleAttorney (name), scheme (name)
  - Include primary debtor: join through MatterParty where isPrimary=true and role=DEBTOR, get Party name
  - Paginate: default pageSize=25
  - Return: { matters, total, page, pageSize }

getById(id: string)
  - Full include: responsibleAttorney, department, scheme, parties (with party details), 
    stageHistory (with changedBy name), tasks (with assignee name), 
    payments (with receiptedBy name), notes (with author name), 
    communications, documents
  - Calculate: outstanding = capitalArrears + interest + legalCosts - totalPaid

create(input: { title, type, schemeId?, responsibleAttorneyId?, priority, capitalArrears, legalCosts, debtorId })
  - Auto-generate reference: BAM-{YYYY}-{NNNN zero-padded} 
    (query max reference for current year, increment by 1)
  - Set openDate to now
  - Set prescriptionDate = openDate + 3 years
  - Link debtorId as MatterParty with role=DEBTOR, isPrimary=true
  - Auto-generate initial tasks (see STAGE_AUTO_TASKS below)
  - Create AuditLog entry
  - Return created matter

update(id, input: { title?, priority?, status?, responsibleAttorneyId?, capitalArrears?, interest?, legalCosts?, customFields? })
  - Update matter
  - Create AuditLog entry with oldData and newData diff
  - Return updated matter

advanceStage(id, { notes? })
  - Stage order: LOD → S129 → SUMMONS → JUDGMENT → WRIT → RULE46 → SALE → CLOSED
  - Cannot advance if already CLOSED
  - Validate prerequisites:
      S129:     requires lodDate
      SUMMONS:  requires s129Date
      JUDGMENT: requires summonsDate
      WRIT:     requires judgmentDate
      RULE46:   requires writDate
      SALE:     requires rule46Date (add this field to schema if missing)
      CLOSED:   no prerequisite
  - Set the new stage's date field to now (e.g., advancing to S129 sets s129Date = now)
  - Create StageHistory record
  - Auto-generate tasks for the new stage (see STAGE_AUTO_TASKS)
  - If advancing to CLOSED: set matter.closeDate = now, status = CLOSED
  - Create AuditLog entry
  - Return updated matter

addNote(matterId, content, isPinned?)
  - Create MatterNote
  - Return note

STAGE_AUTO_TASKS mapping (auto-generate these tasks on stage change):
  LOD:      ["Send Letter of Demand to debtor", "Follow up in 10 days if no response"]
  S129:     ["Issue Section 129 Notice", "Record S129 issue date", "Wait 10 business days"]
  SUMMONS:  ["Draft summons", "Serve summons on debtor", "File proof of service"]
  JUDGMENT: ["Apply for default judgment", "File proof of service", "Await judgment"]
  WRIT:     ["Draft writ of execution", "Lodge writ with sheriff", "Follow up with sheriff"]
  RULE46:   ["File Rule 46 application", "Attend court hearing"]
  SALE:     ["Confirm sale date", "Notify all parties of sale date"]
  CLOSED:   ["Archive all documents", "Issue final statement to client"]

Tasks are assigned to responsibleAttorneyId (or first ADMIN if none), dueDate = now + 5 days.

STEP 2 — Build the matters list page at src/app/(app)/matters/page.tsx

Layout:
  - Page header: "Matters" title + "New Matter" button (gold, top right)
  - Filter bar: search input, stage dropdown filter, status filter, assignee filter
  - Data table with columns:
      Reference (link to /matters/[id], monospace font, gold colour)
      Title
      Debtor Name
      Stage (badge with colour per stage: LOD=blue, S129=yellow, SUMMONS=orange, 
             JUDGMENT=red, WRIT=purple, RULE46=pink, SALE=green, CLOSED=gray)
      Priority (badge: CRITICAL=red, HIGH=orange, MEDIUM=yellow, LOW=gray)
      Capital Arrears (ZAR formatted, right-aligned)
      Outstanding (ZAR formatted, right-aligned)
      Assigned To
      Actions (View button)
  - Pagination controls at bottom
  - Empty state: illustration + "No matters found" text

STEP 3 — Build the "New Matter" dialog/form

Use a shadcn/ui Dialog triggered by the "New Matter" button.
Form fields:
  - Title (text, required)
  - Type (select: LEVY_COLLECTION, LITIGATION, CONVEYANCING, COMMERCIAL_CONTRACT)
  - Priority (select)
  - Scheme (searchable select from schemes list)
  - Debtor (searchable select from parties, or "Create new debtor" option)
  - Responsible Attorney (select from users with role ATTORNEY or ADMIN)
  - Capital Arrears (number input, ZAR)
  - Legal Costs (number input, ZAR)

On submit: call matters.create, close dialog, show toast "Matter BAM-2026-XXXX created", 
  refresh list, navigate to new matter's detail page.

Validate with Zod: title required, capitalArrears >= 0.

STEP 4 — Build the matter detail page at src/app/(app)/matters/[id]/page.tsx

Layout: full page with sticky header + tabbed content

STICKY HEADER (always visible):
  - Reference (monospace, gold) + Title (large, bold)
  - Stage badge + Status badge + Priority badge
  - Quick action buttons (always visible, top right):
      [Advance Stage] (navy button with arrow icon)
      [Receipt Payment] (green button)
      [Generate Document] (blue button)
      [Add Note] (ghost button)
  - Outstanding amount prominently displayed (large red/gold number)

TABS:

Tab 1 — Overview:
  - Financial summary cards: Capital Arrears | Interest | Legal Costs | Total Paid | Outstanding
  - Matter details: Type, Scheme, Assigned To, Open Date, Prescription Date
  - Key stage dates (lodDate, s129Date, etc.) shown as a timeline
  - Prescription warning banner (amber) if prescriptionDate < now + 90 days
  - Risk score gauge (if riskScore is set)

Tab 2 — Financials:
  (Placeholder for Stage 5 — show "Coming in Phase 2" message for now)

Tab 3 — Timeline:
  (Placeholder for Stage 7)

Tab 4 — Documents:
  (Placeholder for Stage 6)

Tab 5 — Tasks:
  - List of tasks for this matter
  - Status filter (All, Pending, Overdue, Completed)
  - Each task row: checkbox to complete, title, assignee, due date, priority badge
  - Overdue tasks highlighted in red
  - "Add Task" button opens inline form

Tab 6 — Parties:
  - List of all parties linked to this matter with their role
  - Each party shows: name, role badge, phone, email, WhatsApp
  - "Add Party" button (link existing debtor + assign role)

STEP 5 — Build the stage advancement modal

Clicking "Advance Stage" opens a Dialog:
  - Show current stage → next stage (with arrow)
  - Show prerequisite validation result (green check or red warning)
  - Optional notes textarea
  - If prerequisite not met: show error message and disable confirm button
  - On confirm: call matters.advanceStage, close modal, refresh page, show toast

STEP 6 — Verify
  - Matter list loads with filter and pagination
  - New Matter form creates a matter and auto-generates reference and tasks
  - Matter detail page loads all tabs
  - Advance Stage works, creates StageHistory, auto-generates tasks
  - Run npx tsc --noEmit (zero errors)
  - Run npm run build (succeeds)

DELIVERABLE FOR THIS STAGE:
- Full matters list with search/filter/pagination
- Create matter form with auto-reference
- Complete matter detail page with 6 tabs
- Working stage advancement with auto-tasks
```

---

---

# STAGE 4 — Debtors, Schemes, Agents & My Diary

## What you are building in this stage
Full party (debtor) management, scheme and agent CRUD, and the personal task diary for each user.

## Pre-conditions
Stages 1–3 complete and working.

---

## PROMPT FOR AGENT — STAGE 4

```
MASTER CONTEXT (paste from above)

WHAT IS ALREADY BUILT:
- Full matters module (list, create, detail, stage advancement, tasks)

STAGE 4 GOAL: Build debtors, schemes, agents pages, and the My Diary page.

STEP 1 — Create the parties tRPC router at src/server/routers/parties.ts

Procedures:

getAll(input: { search?, type?, page?, pageSize? })
  - Search on fullName, companyName, registrationNo, email, phone (ILIKE)
  - Return: { parties, total }
  - Include: count of linked matters per party

getById(id: string)
  - Return full party details
  - Include all linked matters (via MatterParty) with matter reference, title, stage, outstanding

create(input: { type, fullName?, companyName?, registrationNo?, email?, phone?, mobile?, whatsapp?,
  physicalAddress?, postalAddress?, bankDetails?, communicationPreferences?, tags? })
  - Validate SA ID number (13 digits, Luhn algorithm check) if type=INDIVIDUAL and registrationNo provided
  - Create Party record
  - Return created party

update(id, input: same fields as create)
  - Update party
  - Return updated party

search(query: string) → for typeahead
  - Return top 10 matching parties (id, displayName, registrationNo, type)

STEP 2 — Build the debtors list page at src/app/(app)/debtors/page.tsx

Layout:
  - Header: "Debtors" + "New Debtor" button
  - Search bar + type filter (Individual / Company / Trust)
  - Table columns:
      Name (link to /debtors/[id])
      Type (badge)
      SA ID / Reg No.
      Phone | WhatsApp
      Email
      Active Matters (count, badge)
      Actions: View, Edit
  - Pagination

STEP 3 — Build the debtor detail page at src/app/(app)/debtors/[id]/page.tsx

Layout:
  - Header: Debtor name, type badge, tags
  - Contact info card: phone, mobile, WhatsApp, email, address
  - Bank details card (if provided): masked account number
  - Linked matters table: reference, title, stage, outstanding, link to matter
  - Edit button → opens edit form in Dialog

STEP 4 — Build the "New / Edit Debtor" dialog form

Fields:
  - Type (Individual / Company / Trust) — changes form fields
  - For Individual: Full Name, SA ID Number (with validation), Phone, Mobile, WhatsApp, Email
  - For Company: Company Name, Registration Number, Tax/VAT Number, Contact Phone, Email
  - Physical Address: Street, City, Postal Code
  - Postal Address: same structure (with "Same as physical" checkbox)
  - Communication Preferences: toggles for Email OK, WhatsApp OK, SMS OK
  - Tags: comma-separated free text input

SA ID validation: 13 digits, check birth date validity, Luhn checksum. Show inline error.

STEP 5 — Create the schemes tRPC router at src/server/routers/schemes.ts

Procedures:
  getAll() → all schemes with agent name and matter count
  getById(id) → scheme + agent + linked matters list
  create(input: { name, schemeType?, agentId, address?, levyAmount? })
  update(id, input)
  toggleActive(id) → flip isActive

STEP 6 — Build the schemes page at src/app/(app)/schemes/page.tsx

  - Table: Name | Type | Managing Agent | Levy Amount | Active Matters | Status | Actions
  - Inline "New Scheme" button → Dialog form
  - Click scheme name → detail view (show linked matters)

STEP 7 — Create the managing agents tRPC router at src/server/routers/agents.ts

Procedures:
  getAll() → all agents with scheme count
  create(input: { name, contactName?, contactEmail?, contactPhone?, address? })
  update(id, input)
  toggleActive(id)

STEP 8 — Build the agents page at src/app/(app)/agents/page.tsx
  - Table: Name | Contact | Email | Phone | Schemes | Status | Actions
  - "New Agent" button → Dialog form

STEP 9 — Create the tasks tRPC router at src/server/routers/tasks.ts

Procedures:
  getMyTasks(input: { status?, fromDate?, toDate? })
    - Return tasks where assigneeId = current user session id
    - Filter by status and date range if provided
    - Include matter reference and title for context
    - Order: overdue first, then by dueDate asc

  getMatterTasks(matterId: string)
    - Return all tasks for a matter, ordered by dueDate

  create(input: { matterId?, title, description?, priority, dueDate?, assigneeId })

  update(id, input: { title?, description?, priority?, dueDate?, status?, assigneeId? })

  complete(id)
    - Set status = COMPLETED, completedAt = now

  delete(id)

STEP 10 — Build the My Diary page at src/app/(app)/diary/page.tsx

Layout:
  - Header: "My Diary" + "New Task" button + date range filter
  - Three columns or tabs: Overdue | Today & Tomorrow | Upcoming (next 7 days)
  - Each task card shows:
      Title (bold)
      Matter reference + title (link to matter, if linked)
      Priority badge (colour coded)
      Due date (red if overdue)
      Checkbox to mark complete
      Quick edit (pencil icon)
  - Overdue column has red header + count badge
  - Completed tasks section (collapsed by default) at the bottom
  - "New Task" opens a dialog with all task fields

Design: Kanban-style column layout on desktop, stacked on mobile.

STEP 11 — Verify all routes work
  - /debtors list, create, view
  - /schemes list, create
  - /agents list, create
  - /diary shows current user's tasks, can complete them
  - Run npx tsc --noEmit (zero errors)
  - Run npm run build (succeeds)

DELIVERABLE FOR THIS STAGE:
- Full debtors module with SA ID validation
- Schemes and agents CRUD
- My Diary with task management
```

---

---

# STAGE 5 — Financial Module (Payments, Trust Ledger & Interest)

## What you are building in this stage
The full financial module: payment receipting, double-entry ledger, trust account view per matter, interest calculator, and the financials tab on the matter page.

## Pre-conditions
Stages 1–4 complete. The Financials tab on the matter page is currently a placeholder.

---

## PROMPT FOR AGENT — STAGE 5

```
MASTER CONTEXT (paste from above)

WHAT IS ALREADY BUILT:
- Matters, Debtors, Schemes, Agents, Diary all working
- Financials tab on matter detail page is a placeholder

STAGE 5 GOAL: Build the complete financial module.

STEP 1 — Create the financials tRPC router at src/server/routers/financials.ts

Procedures:

receiptPayment(input: { matterId, amount, method, reference?, receivedDate, allocatedTo?, notes? })
  - method options: EFT, CASH, CARD, DEBIT_ORDER, SHERIFF, TRUST_TRANSFER
  - Create Payment record
  - Update matter.totalPaid += amount
  - Create a LedgerTransaction with two LedgerEntries:
      If method = TRUST_TRANSFER:
        Debit  account 1001 (Trust Cash)      amount
        Credit account 2001 (Trust Liability) amount
        Description: "Trust receipt – {matter.reference}"
      Else (direct payment):
        Debit  account 1002 (Operating Cash) amount
        Credit account 4001 (Legal Fees)     amount
        Description: "Payment received – {matter.reference}"
  - Create AuditLog: action=PAYMENT, entityType=MATTER, entityId=matterId
  - Return updated matter financials

getMatterLedger(matterId: string)
  - Return all LedgerTransactions for this matter
  - Each transaction includes its LedgerEntries with account name and code
  - Order by date desc

getTrustBalance(matterId: string)
  - Calculate: sum of DEBIT entries on account 1001 minus sum of CREDIT entries on account 1001
    where matterId = given matterId
  - Return { trustBalance, transactions }

calculateInterest(input: { matterId, fromDate?, toDate? })
  - Get matter.capitalArrears
  - Get active InterestRate (where effectiveFrom <= toDate AND (effectiveTo IS NULL OR effectiveTo >= fromDate))
  - If multiple rates cover the period, calculate each segment separately
  - Formula: capitalArrears × (rate / 100) × (days / 365)
  - Return { principal, rate, fromDate, toDate, days, interestAmount, total }

getPaymentHistory(matterId: string)
  - Return all payments for matter, ordered by receivedDate desc
  - Include receiptedBy user name

generateReceipt(paymentId: string)
  - Return a structured receipt object (not a PDF yet, just the data)
  - { receiptNumber, date, amount, method, reference, debtorName, matterReference, firm }

STEP 2 — Build "Receipt Payment" modal

Triggered by the "Receipt Payment" quick action button on matter detail page.
Opens a Dialog with:
  - Amount (number, required, min 0.01)
  - Payment Method (select: EFT | Cash | Card | Debit Order | Sheriff | Trust Transfer)
  - Reference (text, optional — e.g., bank reference)
  - Received Date (date picker, default today)
  - Allocated To (text, optional — e.g., invoice number)
  - Notes (textarea, optional)

On submit:
  - Call financials.receiptPayment
  - Show toast: "Payment of R{amount} receipted successfully"
  - Close modal, refresh matter data (outstanding balance updates in header)
  - Invalidate tRPC cache for the matter

STEP 3 — Build the Financials tab on matter detail page

Replace the placeholder in the matter detail Financials tab.

Layout:

Section A — Summary Cards (top row):
  Capital Arrears | Interest (calculated) | Legal Costs | Total Paid | OUTSTANDING (large, bold, coloured)

Section B — Interest Calculator:
  "Calculate Interest" collapsible panel:
    - From Date picker (default: lodDate or openDate)
    - To Date picker (default: today)
    - "Calculate" button
  Result shows: Principal × Rate% × Days/365 = Interest Amount
  "Add to Matter" button → updates matter.interest field

Section C — Payment History table:
  Columns: Date | Amount (ZAR) | Method | Reference | Receipted By | Actions
  "Receipt Payment" button above table

Section D — Trust Ledger:
  Heading: "Trust Account – {matter.reference}"
  Trust Balance card (current balance, green if positive)
  Ledger table: Date | Description | Debit | Credit | Running Balance
  Each transaction row expandable to show individual ledger entries with account codes

Design:
  - Use a mini-tabs or sections within the Financials tab
  - Amounts always formatted as "R 15,000.00" using Intl.NumberFormat
  - Outstanding amount coloured red if > 0, green if 0 or negative (overpaid)
  - IBM Plex Mono font for all financial numbers

STEP 4 — Build the Settings page (basic, needed for interest rates)

Path: src/app/(app)/settings/page.tsx
For now, just implement:

Sub-section: Interest Rates
  - Table of InterestRate records
  - "Add Rate" button → Dialog form:
      Rate (%), Effective From date, Effective To date (optional), Type (prescribed/contractual), Description
  - Admin-only: only ADMIN role can add/edit

Sub-section: System Settings (key-value display, admin only)
  Just display SystemSettings as a simple table for now.

STEP 5 — Verify
  - Receipt payment works, matter outstanding balance updates
  - Trust ledger shows correct entries
  - Interest calculator works with correct formula
  - Financials tab is fully populated
  - Settings page shows interest rates
  - Run npx tsc --noEmit (zero errors)
  - Run npm run build (succeeds)

DELIVERABLE FOR THIS STAGE:
- Working payment receipting with double-entry ledger
- Trust account view per matter
- Interest calculator
- Complete Financials tab
- Basic settings page with interest rate management
```

---

---

# STAGE 6 — Document Generation & Storage

## What you are building in this stage
Document template management, DOCX generation with mail merge, R2 storage, versioning, and the Documents tab on the matter page.

## Pre-conditions
Stages 1–5 complete. The Documents tab is a placeholder.

---

## PROMPT FOR AGENT — STAGE 6

```
MASTER CONTEXT (paste from above)

WHAT IS ALREADY BUILT:
- Full financial module working
- Documents tab on matter detail is a placeholder

STAGE 6 GOAL: Build document generation, R2 storage, and the documents module.

STEP 1 — Set up Cloudflare R2 client

Create src/lib/r2.ts:
  - Use @aws-sdk/client-s3 and @aws-sdk/s3-request-presigner
  - Export: uploadFile(key, buffer, contentType) → returns fileUrl (public URL or signed URL)
  - Export: deleteFile(key)
  - Export: getPresignedUrl(key, expiresIn=3600) → signed download URL
  - Bucket name from env R2_BUCKET_NAME
  - Endpoint: https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com

For local dev without real R2: implement a fallback that saves files to /tmp/r2-mock/ 
  and returns a localhost URL. Toggle via env: USE_R2_MOCK=true

STEP 2 — Install document generation libraries
  npm install docxtemplater pizzip
  npm install @types/pizzip (if available, otherwise declare module)
  npm install crypto (built-in, for SHA256 hash)

STEP 3 — Create the document generation service at src/lib/documents.ts

Export function: generateDocument(templateFileUrl, data, outputName)
  - Download template DOCX from R2 (or local mock path)
  - Load with PizZip
  - Create Docxtemplater instance with template
  - Set data (the matter + debtor merged object — see data structure below)
  - Render (this replaces placeholders)
  - Output as Buffer
  - Calculate SHA256 hash of buffer
  - Upload to R2 at key: documents/{matterId}/{outputName}-v{version}.docx
  - Return { fileUrl, fileHash, buffer }

Template data structure (pass this to docxtemplater):
  {
    matter: {
      reference, title, type, stage, openDate, closeDate,
      capitalArrears, interest, legalCosts, totalPaid, outstanding,
      lodDate, s129Date, summonsDate, judgmentDate
    },
    debtor: {
      fullName, companyName, displayName (fullName or companyName),
      registrationNo, email, phone, whatsapp,
      physicalAddress: { street, city, postalCode },
      postalAddress: { street, city, postalCode }
    },
    scheme: { name, address, levyAmount },
    attorney: { name, email },
    today: formatted date,
    firm: { name: "Bam Law", address: "...", phone: "...", email: "..." }
  }

STEP 4 — Create the documents tRPC router at src/server/routers/documents.ts

Procedures:

getTemplates()
  - Return all active DocumentTemplates

getMatterDocuments(matterId: string)
  - Return all documents for matter, ordered by createdAt desc
  - Group by type

generateDocument(input: { matterId, templateId })
  - Load matter with full include (debtor, scheme, attorney)
  - Load template from DB
  - Build template data object
  - Call generateDocument() from lib
  - Get current version (count existing docs of same type + 1)
  - Create Document record in DB
  - Return { documentId, fileUrl, downloadUrl (presigned) }

getDownloadUrl(documentId: string)
  - Get document, generate presigned URL from R2
  - Return { url, expiresAt }

uploadTemplate(input: { name, type, fileBase64, placeholders })
  - Admin only
  - Decode base64 to buffer
  - Upload to R2 at key: templates/{name}.docx
  - Create DocumentTemplate record
  - Return created template

STEP 5 — Create a sample Letter of Demand template

Create a file: prisma/templates/LOD_template.docx

It must contain these placeholders that docxtemplater will replace:
  {{matter.reference}}     — Matter reference
  {{today}}                — Date of letter
  {{debtor.displayName}}   — Debtor full name
  {{debtor.physicalAddress.street}}, {{debtor.physicalAddress.city}}, {{debtor.physicalAddress.postalCode}}
  {{matter.capitalArrears}}
  {{matter.interest}}
  {{matter.legalCosts}}
  {{matter.outstanding}}
  {{attorney.name}}

Add a seed step to upload this template to R2 (or local mock) and create a DocumentTemplate record:
  name = "Letter of Demand", type = LOD, placeholders = [...above list]

STEP 6 — Build the "Generate Document" modal on matter detail page

Triggered by "Generate Document" button.
Dialog content:
  - "Select Template" dropdown (loads from documents.getTemplates)
  - Preview of placeholders that will be filled (read-only list)
  - "Generate" button

On generate:
  - Show loading state "Generating document..."
  - Call documents.generateDocument
  - On success: show "Document generated!" toast with "Download" and "Send via WhatsApp" buttons
  - Refresh Documents tab

STEP 7 — Build the Documents tab on matter detail page

Replace placeholder with:
  - List of generated documents grouped by type
  - Each document row:
      Type badge | Name | Version | Generated By | Generated At | Actions
      Actions: Download (calls getDownloadUrl, opens in new tab), Delete
  - "Generate Document" button (same as quick action)
  - Upload section: "Upload Existing Document" (file input, type select, uploads to R2)

STEP 8 — Build the template management section in Settings

Add sub-section to /settings: "Document Templates"
  - Table: Name | Type | Placeholders | Active | Actions
  - "Upload Template" button → Dialog:
      Name (text), Type (select DocumentType), File upload (.docx only), Placeholders (tag input)
  - Admin only

STEP 9 — Verify
  - Template upload works (to mock R2 in dev)
  - Generate Document creates a real DOCX with merged data
  - Download link works
  - Documents tab shows generated files
  - Run npx tsc --noEmit (zero errors)
  - Run npm run build (succeeds)

DELIVERABLE FOR THIS STAGE:
- R2 storage integration (with local mock fallback)
- DOCX generation with real mail merge
- Letter of Demand sample template
- Documents tab populated
- Template management in Settings
```

---

---

# STAGE 7 — Communications, Timeline & WhatsApp

## What you are building in this stage
The unified communication timeline, WhatsApp integration (with mock for dev), inbound message webhook, and the ability to send documents via WhatsApp directly from the matter page.

## Pre-conditions
Stages 1–6 complete.

---

## PROMPT FOR AGENT — STAGE 7

```
MASTER CONTEXT (paste from above)

WHAT IS ALREADY BUILT:
- Document generation and R2 storage working
- Timeline tab on matter detail is a placeholder

STAGE 7 GOAL: Build the unified timeline, WhatsApp integration, and communications module.

STEP 1 — Create the communications tRPC router at src/server/routers/communications.ts

Procedures:

getMatterTimeline(matterId: string)
  - Return a UNIFIED timeline for the matter — merge and sort by createdAt desc:
      * MatterNote records (type: "note")
      * StageHistory records (type: "stage_change")
      * Payment records (type: "payment")
      * Document records (type: "document")
      * Communication records (type: "communication")
  - Each item has: { type, id, createdAt, data: {...type-specific fields} }
  - Return sorted array

sendWhatsAppMessage(input: { matterId, partyId, message, attachmentUrl? })
  - Look up party.whatsapp (phone number)
  - If WHATSAPP_ACCESS_TOKEN is set: call real WhatsApp Business API
  - If not set (dev): mock the send, log "MOCK WhatsApp: {message} to {phone}"
  - Create Communication record: direction=OUTBOUND, channel=WHATSAPP, status=SENT
  - Return { communicationId, status }

STEP 2 — Create the WhatsApp service at src/lib/whatsapp.ts

Export function: sendWhatsAppText(to: string, message: string) → Promise<{messageId, status}>
  Real implementation:
    POST https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages
    Body: { messaging_product: "whatsapp", to, type: "text", text: { body: message } }
    Headers: Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
    Return external message ID

  Mock (if no token): 
    console.log(`[WhatsApp MOCK] To: ${to}\nMessage: ${message}`)
    Return { messageId: "mock_" + Date.now(), status: "sent" }

Export function: sendWhatsAppDocument(to, documentUrl, caption)
  Real: send document message type to WhatsApp API
  Mock: log and return mock ID

STEP 3 — Create the WhatsApp webhook endpoint

Create src/app/api/webhooks/whatsapp/route.ts

GET handler (webhook verification):
  - Check query params: hub.mode, hub.verify_token, hub.challenge
  - If hub.verify_token matches WHATSAPP_WEBHOOK_VERIFY_TOKEN env var: return hub.challenge
  - Else: return 403

POST handler (incoming messages):
  - Parse WhatsApp webhook payload
  - For each message in entry[].changes[].value.messages:
      phone = message.from
      body = message.text?.body or caption
      type = message.type
      externalId = message.id
  - Find Party by whatsapp = phone (normalize: remove leading zeros, add +27 prefix)
  - If party found: find their most recent ACTIVE matter
  - Create Communication:
      direction = INBOUND, channel = WHATSAPP, from = phone, to = firm's number
      body = message body, externalId, status = DELIVERED
      matterId = found matter id (or null)
  - Return 200 OK (always, to acknowledge webhook)

STEP 4 — Build the Timeline tab on matter detail page

Replace placeholder with the unified timeline feed.

Timeline item designs:
  NOTE:         📝 blue-left-border, author avatar, content text, timestamp
  STAGE_CHANGE: 🔄 purple-left-border, "Stage advanced from X to Y by {user}", optional note
  PAYMENT:      💰 green-left-border, "Payment of R{amount} received via {method}", reference
  DOCUMENT:     📄 orange-left-border, document name + type badge + download link
  COMMUNICATION:💬 teal-left-border, channel badge (WhatsApp/Email/SMS), message body,
                    direction indicator (→ outbound, ← inbound), status badge

Layout:
  - Vertical timeline with connecting line
  - Newest item at top
  - "Add Note" inline form at the top of the timeline (textarea + pin checkbox + submit)
  - "Send WhatsApp" button opens compose dialog (step 5 below)

STEP 5 — Build the "Send WhatsApp Message" dialog

Accessible from:
  a) "Send via WhatsApp" button on generated document
  b) Timeline tab → "Send WhatsApp" button

Dialog fields:
  - To: (pre-filled with debtor's WhatsApp number, editable)
  - Message: (textarea, pre-populated with a template message)
  - Attach document: (optional — dropdown of this matter's documents)
  - Preview: show message with line breaks

On send:
  - Call communications.sendWhatsAppMessage
  - Show toast: "Message sent to {phone}"
  - Timeline refreshes to show the new outbound message

STEP 6 — Add "Send via WhatsApp" to document rows in Documents tab

Each document row in the Documents tab gets a "Send via WhatsApp" button.
Clicking it opens the WhatsApp compose dialog with the document pre-attached.

STEP 7 — Verify
  - Timeline shows merged notes, stage changes, payments, documents, comms in order
  - Adding a note appears on the timeline immediately
  - "Send WhatsApp" mock works, creates Communication record, appears on timeline
  - Webhook GET verification returns hub.challenge
  - Run npx tsc --noEmit (zero errors)
  - Run npm run build (succeeds)

DELIVERABLE FOR THIS STAGE:
- Unified matter timeline (all event types)
- WhatsApp send (mock + real API structure)
- Inbound WhatsApp webhook
- Timeline tab populated
```

---

---

# STAGE 8 — AI Features (Risk Score, Next Action, Prescription Warnings)

## What you are building in this stage
AI-powered risk scoring, next action suggestions, prescription warnings, and document auto-classification. All features must degrade gracefully if no OpenAI API key is set.

## Pre-conditions
Stages 1–7 complete.

---

## PROMPT FOR AGENT — STAGE 8

```
MASTER CONTEXT (paste from above)

WHAT IS ALREADY BUILT:
- All core modules working: matters, debtors, financials, documents, timeline

STAGE 8 GOAL: Add AI-powered intelligence features. All must work with a mock if OPENAI_API_KEY is not set.

STEP 1 — Create the AI service at src/lib/ai.ts

Install: npm install openai

Export function: getRiskScore(matterData) → Promise<{ score: number, reasoning: string }>
  
  matterData: { stage, capitalArrears, totalPaid, openDate, prescriptionDate, debtorMatterCount, paymentCount }
  
  If OPENAI_API_KEY is set:
    Call OpenAI chat completion (gpt-3.5-turbo):
    System: "You are a legal risk analyst. Return ONLY JSON in this format: {\"score\": 0.0-1.0, \"reasoning\": \"...\"}"
    User: "Matter data: {JSON.stringify(matterData)}.
           Score the risk 0 (low) to 1 (high) based on:
           - Stage (JUDGMENT/WRIT/RULE46 = higher risk)
           - Amount outstanding vs paid ratio
           - How long the matter has been open
           - Debtor's history (number of matters)
           Return only the JSON."
    Parse response JSON, return { score, reasoning }
  
  If no API key (mock):
    Calculate a simple heuristic score:
      score = 0.3 (base)
      if stage in [JUDGMENT, WRIT, RULE46, SALE]: score += 0.3
      if (capitalArrears - totalPaid) > 50000: score += 0.2
      if debtorMatterCount > 2: score += 0.15
      score = Math.min(score, 0.95)
    Return { score, reasoning: "Mock score based on heuristics" }

Export function: getNextActionSuggestion(matterData) → Promise<{ suggestion: string, confidence: number }>

  If OPENAI_API_KEY is set:
    Call OpenAI chat completion:
    System: "You are a legal collections expert. Return ONLY JSON: {\"suggestion\": \"...\", \"confidence\": 0.0-1.0}"
    User: "A levy collection matter is at stage {stage}. Outstanding: R{outstanding}.
           Last action was {daysSinceLastAction} days ago.
           Overdue tasks: {overdueTaskCount}.
           What is the single most important next action? Be specific and actionable."
    Parse and return

  If no API key (mock):
    Return pre-defined suggestions per stage:
      LOD: { suggestion: "Follow up with debtor by phone if no response within 10 days. Send WhatsApp reminder.", confidence: 0.72 }
      S129: { suggestion: "Confirm Section 129 notice was delivered. Proceed to summons if 10 business days have passed.", confidence: 0.80 }
      SUMMONS: { suggestion: "Check proof of service. Set default judgment hearing date.", confidence: 0.78 }
      JUDGMENT: { suggestion: "Apply for writ of execution immediately.", confidence: 0.85 }
      default: { suggestion: "Review matter status and advance to next stage if prerequisites are met.", confidence: 0.60 }

Export function: classifyDocument(fileName, extractedText?) → Promise<{ type: DocumentType, confidence: number }>
  Simple keyword matching (no API needed):
    if filename or text contains "letter of demand" or "LOD": return LOD
    if contains "section 129" or "s129": return S129
    if contains "summons": return SUMMONS
    if contains "judgment": return JUDGMENT
    if contains "writ": return WRIT
    if contains "invoice": return INVOICE
    if contains "receipt": return RECEIPT
    else: return OTHER

STEP 2 — Create the AI tRPC router at src/server/routers/ai.ts

Procedures:

refreshRiskScore(matterId: string)
  - Load matter with debtor matter count and payment count
  - Call ai.getRiskScore
  - Update matter.riskScore in DB
  - Create AuditLog: action=AI_RISK_SCORE, entityId=matterId, newData={score, reasoning}
  - Return { score, reasoning }

getNextAction(matterId: string)
  - Load matter with days since last task completion
  - Call ai.getNextActionSuggestion
  - Return { suggestion, confidence }

createTaskFromSuggestion(input: { matterId, suggestion })
  - Create a new Task from the AI suggestion
  - assigneeId = responsibleAttorneyId of matter
  - dueDate = now + 2 days
  - isAutoGenerated = true
  - Return task

STEP 3 — Calculate prescription warnings (no AI needed)

Add to the matters router:

getPrescriptionWarnings()
  - Find all ACTIVE matters where prescriptionDate IS NOT NULL
  - AND prescriptionDate < (now + 90 days)
  - Return list with: matterId, reference, title, prescriptionDate, daysUntilPrescription, debtorName
  - Order by daysUntilPrescription asc

STEP 4 — Add AI widgets to the matter detail Overview tab

AI Risk Score widget:
  Position: right side of Overview tab
  - Show risk gauge (circular progress or segmented bar): 0% = green, 50% = amber, 80%+ = red
  - Score as percentage (e.g., "72% Risk")
  - Reasoning text (collapsed, expandable)
  - "Refresh Score" button → calls ai.refreshRiskScore, shows new score
  - If riskScore is null: show "Score not calculated" + "Calculate" button

AI Next Action widget (below risk score):
  - Show the suggested next action text
  - Confidence badge (e.g., "80% confidence")
  - "Create Task from This" button → calls ai.createTaskFromSuggestion, shows toast
  - "Refresh Suggestion" button

STEP 5 — Add prescription warning banner to matter header

On matter detail sticky header:
  If matter.prescriptionDate is within 90 days:
    Show amber banner below the header:
    "⚠️ Prescription Warning: This matter prescribes on {date} ({X} days remaining). 
    Obtain acknowledgement of debt immediately."
  If already prescribed (prescriptionDate < today):
    Show red banner: "🚨 PRESCRIBED: This matter may have prescribed on {date}."

STEP 6 — Add prescription warnings to dashboard

In getDashboardStats: prescriptionWarnings count is already there.
Add a "Prescription Risk" widget on dashboard:
  - If count > 0: show amber card with count + "View All" link
  - Clicking navigates to /reports/prescription (or shows a modal list)

STEP 7 — Auto-classify on document upload

When a document is uploaded (not generated) in the Documents tab:
  - After upload, call ai.classifyDocument with the filename
  - Pre-select the suggested DocumentType in the "Document Type" field
  - Show "AI suggested: LOD (92% confidence)" hint text below the field
  - User can override

STEP 8 — Verify AI features work in mock mode (no API key)
  - Risk score calculates and displays gauge
  - Next action suggestion appears with correct stage-based text
  - Prescription warning banner shows on a matter with prescriptionDate within 90 days
  - Document upload suggests type based on filename
  - Run npx tsc --noEmit (zero errors)
  - Run npm run build (succeeds)

DELIVERABLE FOR THIS STAGE:
- Risk score with visual gauge (mock + real OpenAI)
- Next action suggestion with task creation
- Prescription warning banners on matter and dashboard
- Document auto-classification
```

---

---

# STAGE 9 — Reports, Settings & Final Polish

## What you are building in this stage
The full reports module, user management in settings, final responsive polish, and production deployment preparation.

## Pre-conditions
Stages 1–8 complete and all features working.

---

## PROMPT FOR AGENT — STAGE 9

```
MASTER CONTEXT (paste from above)

WHAT IS ALREADY BUILT:
- All core modules: matters, debtors, financials, documents, timeline, WhatsApp, AI

STAGE 9 GOAL: Build the reports module, complete settings, polish the UI, and prepare for production deployment.

STEP 1 — Create the reports tRPC router at src/server/routers/reports.ts

Procedures:

getAgedDebtors(input: { asAt?: Date })
  - For each ACTIVE matter, calculate outstanding (capitalArrears + interest + legalCosts - totalPaid)
  - Group by aging bucket based on openDate:
      Current (< 30 days)
      30–60 days
      60–90 days
      90–180 days
      180+ days
  - Within each bucket, group by stage
  - Return: { buckets: [{label, count, total, byStage: [{stage, count, total}]}], grandTotal }

getCollectorPerformance(input: { fromDate?, toDate? })
  - Group matters by responsibleAttorneyId
  - For each attorney:
      Total active matters
      Matters closed in date range (status=CLOSED, closeDate in range)
      Total collected (sum of payments.amount in date range)
      Average days to close
  - Return sorted by total collected desc

getPrescriptionRisk()
  - Return matters approaching or past prescription
  - Group by: prescribing in 0–30 days, 30–60 days, 60–90 days, already prescribed
  - Each matter: reference, title, debtor, prescriptionDate, daysRemaining, stage

getPipelineSummary()
  - Count and total outstanding per stage
  - Also return average age per stage
  - Return trend: if previousMonth data available, show change %

getFinancialSummary(input: { fromDate, toDate })
  - Total receipted (sum of payments in period)
  - Total capital outstanding
  - Total interest outstanding
  - Total legal costs outstanding
  - New matters opened in period
  - Matters closed in period

STEP 2 — Build the Reports page at src/app/(app)/reports/page.tsx

Layout: sidebar sub-navigation with 5 report types

Report 1 — Aged Debtors:
  - Filter: "As At" date picker (default today)
  - Summary row: total outstanding per bucket (large coloured numbers)
  - Table per bucket:
      Matter | Debtor | Stage | Capital | Interest | Costs | Total Outstanding | Open Date | Days
  - Export to CSV button

Report 2 — Collector Performance:
  - Date range filter
  - Card per collector:
      Avatar + name | Active matters | Closed this period | Amount collected | Avg days to close
  - Bar chart (using simple CSS bars, no chart library needed) showing collected by collector

Report 3 — Prescription Risk:
  - Four coloured groups (red, amber, yellow, gray)
  - Each matter row: Reference | Title | Debtor | Stage | Prescription Date | Days Remaining
  - "Take Action" button on each row → navigates to matter

Report 4 — Pipeline Summary:
  - Stage-by-stage breakdown: count + total outstanding
  - Visual funnel or horizontal bar for each stage
  - Average age in each stage (days)

Report 5 — Financial Summary:
  - Date range filter
  - Top stats: Total Receipted | New Matters | Matters Closed
  - Payment breakdown by method (pie chart using SVG)

All reports:
  - "Export CSV" button on each report (client-side CSV generation)
  - Print-friendly layout (CSS @media print)

STEP 3 — Complete the Settings page at src/app/(app)/settings/page.tsx

Add these sub-sections (admin only, show 403 if not ADMIN):

User Management:
  Table: Name | Email | Role | Status | Last Login | Actions
  "Add User" button → Dialog: name, email, password, role
  "Edit" → same Dialog pre-filled
  "Deactivate" → toggle isActive

Interest Rates:
  Already built in Stage 5, ensure it's complete.

Document Templates:
  Already built in Stage 6, ensure it's complete.

System Settings:
  Key-value list. Show: firm name, firm address, firm email, firm phone
  Allow admin to update via inline editing

STEP 4 — Build the Agent Viewer Portal (basic)

Path: src/app/(portal)/portal/page.tsx

A simplified view for managing agents (role AGENT_VIEWER):
  - Show only matters belonging to schemes linked to this agent
  - Read-only: cannot edit matters
  - Shows: matter reference, debtor, stage, outstanding, key dates
  - Can only see matters (no financials, no documents)

STEP 5 — Mobile Responsiveness Audit

Check EVERY page at 375px width and fix:
  - Sidebar: converts to bottom Sheet/drawer on mobile
  - All tables: convert to card layout on mobile (hide columns, stack info)
  - Matter detail header: stack buttons vertically on mobile
  - Dashboard widgets: single column on mobile
  - All dialogs: full-screen on mobile

STEP 6 — Loading States & Error Handling

Every tRPC query must have:
  - Skeleton loading state (use shadcn/ui Skeleton)
  - Error boundary with user-friendly message
  - Empty state with icon + message + action button

Every tRPC mutation must have:
  - Loading spinner on submit button
  - Success toast notification
  - Error toast with message

STEP 7 — Audit Log viewer (admin only)

Add to Settings: "Audit Log" sub-section
  - Table: Date | User | Action | Entity | Details
  - Filter by user, action type, date range
  - Show last 500 entries

STEP 8 — Write the README.md

Create README.md at project root with:
  1. Project overview (what it is and who it's for)
  2. Tech stack
  3. Prerequisites (Node.js version, etc.)
  4. Setup instructions:
      - Clone repo
      - npm install
      - Copy .env.local.example to .env.local and fill values
      - npx prisma migrate deploy
      - npx prisma db seed
      - npm run dev
  5. Environment variables table (key | description | required)
  6. Default credentials after seeding:
      Admin:     admin@bam.co.za / Admin@123
      Attorney:  attorney@bam.co.za / Admin@123
      Collector: collector@bam.co.za / Admin@123
  7. Deployment guide (Vercel + Neon + R2)
  8. WhatsApp setup guide

STEP 9 — Production build and final checks

Run through this checklist:

Security:
  [ ] All routes protected by middleware
  [ ] Admin-only routes check role server-side (not just client)
  [ ] No secrets in client bundle (use NEXT_PUBLIC_ only where needed)
  [ ] Passwords hashed with bcrypt (never stored in plain text)
  [ ] File uploads validate type (only .docx for templates)

Performance:
  [ ] All list pages paginated (no full-table queries)
  [ ] Database indexes in place (already in schema)
  [ ] Images/assets optimised

Quality:
  [ ] Run: npx tsc --noEmit → zero errors
  [ ] Run: npm run lint → zero warnings
  [ ] Run: npm run build → succeeds
  [ ] Test login, create matter, advance stage, receipt payment, generate doc, send WhatsApp (mock)

STEP 10 — Deploy to Vercel

  1. Push code to GitHub
  2. Import project in Vercel
  3. Add all environment variables in Vercel dashboard
  4. Set Build Command: npm run build
  5. Set Output Directory: .next
  6. Deploy
  7. After deploy: run database migrations via Vercel CLI or Neon console:
       npx prisma migrate deploy
       npx prisma db seed
  8. Test production URL

DELIVERABLE FOR THIS STAGE:
- Complete reports module (5 reports with export)
- User management in Settings
- Agent Viewer portal
- Full mobile responsiveness
- Loading/error states on every page
- Audit log viewer
- Complete README.md
- Successful production deployment on Vercel

---

FINAL SIGN-OFF CHECKLIST FOR THE AGENT:
Before handing over, confirm all of these work end-to-end:

[ ] Login + logout (all 3 roles)
[ ] Create a matter → auto-reference generated → tasks created
[ ] Advance stage LOD → S129 → new tasks appear
[ ] Receipt payment → ledger updated → outstanding balance changes
[ ] Generate Letter of Demand → DOCX created → download works
[ ] Send mock WhatsApp → Communication record created → appears on timeline
[ ] AI risk score calculated (mock) → gauge displayed
[ ] Prescription warning shows if matter is < 90 days from prescribing
[ ] Reports page: aged debtors loads with real data
[ ] Dark mode toggle works everywhere
[ ] Mobile layout works at 375px
[ ] npx tsc --noEmit passes
[ ] npm run build succeeds
[ ] README.md is complete

CONGRATULATIONS: Bam Law PMS is production-ready.
```

---

## QUICK REFERENCE: Stage Summary

| Stage | What Gets Built | Estimated Sessions |
|-------|----------------|-------------------|
| 1 | Scaffold, Schema, Auth, Seed | 1–2 |
| 2 | App Shell, Navigation, Dashboard | 1–2 |
| 3 | Matters (List, Create, Detail, Stage Advance) | 2–3 |
| 4 | Debtors, Schemes, Agents, My Diary | 1–2 |
| 5 | Financials, Trust Ledger, Interest | 1–2 |
| 6 | Documents, DOCX Generation, R2 Storage | 1–2 |
| 7 | Timeline, WhatsApp, Communications | 1–2 |
| 8 | AI: Risk Score, Next Action, Prescription | 1 |
| 9 | Reports, Settings, Polish, Deployment | 2–3 |

**Total: 9 stages. Each stage is independently testable and deliverable.**

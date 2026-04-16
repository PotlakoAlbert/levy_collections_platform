# LevyConnect — Levy Collection Practice Management Platform

## Overview

Full-stack South African law firm levy collection management platform. Built as a pnpm monorepo with:
- **Frontend**: React + Vite (LevyConnect at `/`)
- **Backend**: Express 5 API server at port 8080
- **Database**: PostgreSQL + Drizzle ORM

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec → React Query hooks)
- **Build**: esbuild

## Architecture

```
lib/
  api-spec/       — OpenAPI YAML spec
  api-zod/        — Generated Zod schemas from spec  
  api-client-react/ — Generated React Query hooks from spec
  db/             — Drizzle schema + migrations

artifacts/
  api-server/     — Express 5 backend
  levy-platform/  — React Vite frontend (main app)
  mockup-sandbox/ — Design sandbox
```

## Key Commands

- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes
- `pnpm --filter @workspace/api-server run dev` — run API server

## Features Implemented

- **Authentication**: JWT (Bearer token in localStorage), bcrypt passwords
- **Roles**: ADMIN, ATTORNEY, COLLECTOR, AGENT_VIEWER
- **Pipeline stages**: LOD → S129 → SUMMONS → JUDGMENT → WRIT → RULE46 → SALE → CLOSED
- **Matters**: Full CRUD with stage advancement and auto-task creation
- **Debtors**: SA ID number, DEFAULTING/ABSCONDED/ACTIVE/DECEASED status
- **Schemes**: Sectional title schemes linked to managing agents
- **Documents**: HTML generation with merge fields (LOD, S129, SUMMONS, JUDGMENT, WRIT)
- **Payments**: EFT/cheque/cash allocation to capital/interest/costs
- **Tasks/Diary**: Auto-generated on stage change, manual tasks, overdue tracking
- **Reports**: Pipeline summary, aged debtors analysis, collections by agent
- **Dashboard**: KPI cards, stage chart, overdue tasks panel
- **Interest**: SA prescribed rate calculation (multi-period from interest_rates table)

## Seed Credentials

- **Admin**: `admin@bamlaw.co.za` / `Admin123!`
- **Attorney**: `attorney@bamlaw.co.za` / `Admin123!`
- **Collector**: `collector@bamlaw.co.za` / `Admin123!`

## API Routes

All routes prefixed with `/api`:
- `POST /api/auth/login` — authenticate
- `GET /api/auth/me` — current user
- `GET|POST /api/users` — user management
- `GET|POST /api/agents` — managing agents
- `GET|POST /api/schemes` — schemes
- `GET|POST /api/debtors` — debtors
- `GET|POST /api/matters` — matters list/create
- `GET|PATCH /api/matters/:id` — matter detail/update
- `PUT /api/matters/:id/stage` — advance pipeline stage
- `POST /api/matters/:id/documents` — generate document
- `GET|POST /api/payments` — payments
- `GET|POST|PATCH /api/tasks` — tasks/diary
- `GET /api/reports/pipeline-summary` — pipeline stats
- `GET /api/reports/aged-debtors` — aging analysis
- `GET /api/reports/collections-by-agent` — collection stats
- `GET /api/dashboard/summary` — dashboard KPIs
- `GET /api/dashboard/overdue-tasks` — overdue tasks list

## SA-Specific Notes

- Currency: South African Rand (R X,XXX.XX)
- Date format: DD/MM/YYYY
- Interest: Prescribed rate 11.00% p.a. (from interest_rates table)
- Matter reference: BAM-YYYY-XXXX
- Section 129 NCA notice workflow

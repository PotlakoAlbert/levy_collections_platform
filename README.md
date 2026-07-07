# Levy Collection Manager

A production-oriented, automation-first platform for legal collections and matter management. This monorepo brings together a modern React frontend, a TypeScript API server, shared database tooling, and workflow automation for debtors, matters, documents, payments, reminders, and reporting.

It is designed to help law firms manage collection matters with less manual effort, stronger visibility, and a more structured operational workflow.

## Why this project stands out

- Full-stack architecture with a clear separation between UI, API, business logic, and data access
- Workflow automation for routine legal collection tasks, reducing repetitive manual work
- Real-time communication capabilities, including WhatsApp-based debtor engagement
- Event-driven automation with background job processing and scheduled workflows
- Strong documentation and modular structure suitable for portfolio presentation, technical interviews, and team collaboration

## Product overview

Levy Collection Manager is a case and collections platform built around the realities of legal operations:

- Manage matters, debtors, schemes, payments, and documents in one system
- Track progress through collection stages and workflow states
- Generate and send legal documents and notices
- Automate reminders, follow-up actions, and periodic processing
- Monitor operational health through admin and reporting endpoints
- Support human-in-the-loop exception handling where complex decisions are needed

The system is structured as a reusable platform that can be positioned as a law-firm-ready solution rather than a one-off internal tool.

## Core capabilities

### Matter and debtor management
- Create and manage collection matters
- Maintain debtor details and relationship history
- Model collection stages and lifecycle progression
- Support case-specific workflow decisions and assignment logic

### Document and communication workflow
- Generate and manage documents tied to matters
- Send communications through supported channels
- Maintain an audit trail of interactions and workflow events
- Integrate with WhatsApp-based debtor communication flows

### Payments and financial tracking
- Record payments against matters
- Support allocation logic and collection-related financial updates
- Maintain operational visibility into outstanding balances and activity

### Automation and orchestration
- Event-driven triggers for key business events
- Background job processing for asynchronous actions
- Scheduled jobs for nightly or periodic processing
- Queue-based processing for reliability and separation of concerns

### Reporting and administration
- Reporting endpoints for operational insight
- Admin endpoints for queue health, automation metrics, and configuration visibility
- Structured logging and observability hooks for monitoring

## Architecture at a glance

The repository is organized as a pnpm workspace with distinct layers:

- Frontend: React + Vite + TypeScript + Tailwind UI
- Backend: Express + TypeScript + structured logging
- Shared data layer: Drizzle ORM and database schema package
- Automation layer: BullMQ, Redis, cron jobs, and event handlers
- Real-time layer: WebSocket-based updates and communication callbacks

### High-level flow

```text
User action / API request
  -> Route handler
  -> Business logic / service layer
  -> Database persistence
  -> Event or background job trigger
  -> Automation worker / notification / reporting pipeline
  -> Audit trail and UI visibility
```

## Technology stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript, Tailwind CSS, Wouter, React Query |
| UI components | Radix UI, shadcn-style component patterns, Framer Motion |
| Backend | Express.js, TypeScript, Pino, Socket.IO |
| Data access | Drizzle ORM, PostgreSQL-style schema layer |
| Automation | BullMQ, Redis, node-cron |
| AI / communication | OpenAI-compatible tooling, WhatsApp integration |
| Tooling | pnpm workspaces, Vitest, TypeScript, Vite |

## Repository structure

```text
artifacts/api-server/     Backend API, routes, automation workers, cron jobs
artifacts/levy-platform/  React frontend and main user experience
lib/db/                   Shared database schema and persistence layer
lib/api-client-react/     Shared API client for frontend consumption
lib/api-zod/              Shared validation and schema helpers
md files/                 Project documentation, architecture notes, and delivery records
scripts/                  Workspace scripts and setup helpers
```

## Key implementation areas

### 1. Backend services
The API server contains:
- Auth and user access routes
- Matter, debtor, document, payment, task, and communication endpoints
- Admin and reporting routes
- Webhook handling for notification and integration flows
- Queue and worker initialization for automation

### 2. Frontend experience
The frontend includes pages for:
- Dashboard
- Matters
- Debtors
- Schemes
- Documents
- Reports
- Diary
- Automation status
- Settings

### 3. Automation engine
The system includes asynchronous processing for:
- Matter-related actions
- Reminder and follow-up flows
- Notification delivery
- Scheduled processing
- Event-driven progression and business logic

### 4. Shared infrastructure
The project uses shared packages for:
- Database schema and migrations-style modeling
- API client integration
- Validation and type-safe data contracts

## Development setup

### Prerequisites
- Node.js
- pnpm
- Redis for queue-backed automation flows
- A configured database environment for the API layer

### Install dependencies

```bash
pnpm install
```

### Run the backend

```bash
pnpm --filter @workspace/api-server dev
```

### Run the frontend

```bash
pnpm --filter @workspace/levy-platform dev
```

### Useful workspace scripts

```bash
pnpm build
pnpm typecheck
pnpm --filter @workspace/api-server test
```

## Environment configuration

The project includes environment-driven configuration for the API and frontend. Typical configuration areas include:

- API URL and runtime settings
- Authentication and session secrets
- Redis / queue configuration
- WhatsApp integration values
- AI and messaging service settings

The repository contains example environment files under the relevant application folders for reference.

## Quality and engineering highlights

This project demonstrates several engineering strengths that are valuable in professional software development:

- Strong TypeScript usage across the workspace
- Modular package boundaries and shared libraries
- Clear separation between UI, API, and automation concerns
- Event-driven architecture with background workers
- Logging, monitoring, and admin visibility hooks
- Documentation-first structure with detailed implementation records
- Portfolio-ready scale and complexity for a full-stack product

## Example workflow

A typical matter lifecycle in the platform may involve:

1. Creating a matter and associated debtor records
2. Generating and sending relevant documents
3. Triggering reminder or communication workflows
4. Recording payments and updating case progress
5. Running automation for follow-up and ongoing collection activity
6. Surfacing status through reports and admin views

This makes the product feel less like a static CRUD app and more like a workflow-driven operations platform.

## Project documentation

The repository includes a substantial documentation set under the md files directory covering:
- Architecture and transformation notes
- Automation implementation guides
- Delivery and implementation summaries
- System overview and technical reference material

These documents help make the project easier to understand, review, and present to stakeholders, recruiters, or collaborators.

## Why this is a strong portfolio project

This repository is a strong example of:
- End-to-end product thinking
- Backend API design and modular service structure
- Frontend application composition and route organization
- Automation and event-driven systems
- Documentation discipline and engineering communication
- Building a practical business workflow tool rather than a toy demo

It is well suited for demonstrating capabilities in:
- Full-stack development
- Systems design thinking
- Workflow automation
- API and UI integration
- Technical documentation and delivery

## License

This workspace is currently marked as MIT in the root package configuration.

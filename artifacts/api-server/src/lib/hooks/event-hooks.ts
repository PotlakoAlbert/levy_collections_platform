/**
 * Event Hooks System - REFACTORED ARCHITECTURE
 * 
 * BEFORE: 799 lines in single file (14 event handlers mixed together)
 * AFTER: Individual focused handler files (50-80 lines each) + orchestrator (13 lines)
 * 
 * Architectural Benefits:
 * ✅ Each handler is ~60 lines (focused, testable, maintainable)
 * ✅ Easy debugging - find specific event logic in dedicated file  
 * ✅ Add/remove handlers independently without touching main file
 * ✅ Clear single responsibility per handler
 * ✅ Perfect for team scaling - multiple devs on different handlers
 * ✅ Simple unit testing of handlers in isolation
 * ✅ No circular dependencies
 * ✅ Easy to understand code flow
 * 
 * Handler Files:
 * - handlers/index.ts (orchestrator & registry - core dispatcher logic)
 * - handlers/matter-created.handler.ts (MATTER_CREATED event)
 * - handlers/payment-received.handler.ts (PAYMENT_RECEIVED event)
 * - handlers/stage-changed.handler.ts (STAGE_CHANGED event)
 * - handlers/interest-calculation.handler.ts (INTEREST_CALCULATION event)
 * - handlers/debtor-created.handler.ts (DEBTOR_CREATED event)
 * (Additional handlers can be created for other event types)
 * 
 * Usage is backward compatible - just re-export from handlers/index
 */

export * from "./handlers/index";

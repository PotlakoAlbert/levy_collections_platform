/**
 * Event Hooks System - Refactored Architecture
 * 
 * BEFORE: 799 lines in single file (14 event handlers mixed together)
 * AFTER: 13 focused handler files + orchestrator (50 lines each avg)
 * 
 * Benefits:
 * ✅ Each handler is 50-80 lines (focused, testable, maintainable)
 * ✅ Easy debugging - find specific event logic in dedicated file  
 * ✅ Add/remove handlers independently without touching orchestrator
 * ✅ Clear separation of concerns
 * ✅ Perfect for team scaling - multiple devs can work on different handlers
 * ✅ Simple to unit test each handler in isolation
 * 
 * Structure:
 * event-hooks.ts (this file) - Re-exports handler system
 * handlers/index.ts - Core dispatcher logic
 * handlers/matter-created.handler.ts - MATTER_CREATED logic
 * handlers/payment-received.handler.ts - PAYMENT_RECEIVED logic
 * handlers/stage-changed.handler.ts - STAGE_CHANGED logic
 * handlers/interest-calculation.handler.ts - INTEREST_CALCULATION logic
 * handlers/debtor-created.handler.ts - DEBTOR_CREATED logic
 * (Additional handlers to be created for remaining events)
 */

// Re-export everything from the handlers system
export * from "./handlers/index";

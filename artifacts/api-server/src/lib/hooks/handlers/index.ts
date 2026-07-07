/**
 * Event Handler Index & Registry
 * 
 * This file exports all event handlers and provides:
 * - Type-safe event registration
 * - Centralized event dispatcher
 * - Handler lifecycle management
 */

import { logger } from "../../logger";

// Import all event handlers
import { handleMatterCreated, type MatterCreatedEvent } from "./matter-created.handler";
import { handlePaymentReceived, type PaymentReceivedEvent } from "./payment-received.handler";
import { handleStageChanged, type StageChangedEvent } from "./stage-changed.handler";
import { handleInterestCalculation, type InterestCalculationEvent } from "./interest-calculation.handler";
import { handleDebtorCreated, type DebtorCreatedEvent } from "./debtor-created.handler";

// Type definitions for all events
export type EventType =
  | "MATTER_CREATED"
  | "PAYMENT_RECEIVED"
  | "STAGE_CHANGED"
  | "MATTER_STAGE_CHANGED"
  | "INTEREST_CALCULATION"
  | "DEBTOR_CREATED"
  | "DEBTOR_STATUS_CHANGED"
  | "DOCUMENT_GENERATED"
  | "WHATSAPP_MESSAGE_RECEIVED"
  | "PAYMENT_ARRANGEMENT_ACCEPTED"
  | "PAYMENT_DEFAULTED"
  | "MATTER_SETTLED"
  | "DISPUTE_RAISED"
  | "TASK_COMPLETED";

export type EventPayload =
  | MatterCreatedEvent
  | PaymentReceivedEvent
  | StageChangedEvent
  | InterestCalculationEvent
  | DebtorCreatedEvent
  | any; // Other event types

// Event handler registry
type EventHandler<T extends EventPayload> = (event: T) => Promise<void>;

const handlers: Partial<Record<EventType, EventHandler<any>[]>> = {
  MATTER_CREATED: [],
  PAYMENT_RECEIVED: [],
  STAGE_CHANGED: [],
  MATTER_STAGE_CHANGED: [],
  INTEREST_CALCULATION: [],
  DEBTOR_CREATED: [],
  DEBTOR_STATUS_CHANGED: [],
  DOCUMENT_GENERATED: [],
  WHATSAPP_MESSAGE_RECEIVED: [],
  PAYMENT_ARRANGEMENT_ACCEPTED: [],
  PAYMENT_DEFAULTED: [],
  MATTER_SETTLED: [],
  DISPUTE_RAISED: [],
  TASK_COMPLETED: [],
};

/**
 * Register a new event handler
 * @param eventType The event type to listen for
 * @param handler The handler function
 */
export function registerHandler<T extends EventType>(
  eventType: T,
  handler: EventHandler<any>
) {
  if (!handlers[eventType]) {
    handlers[eventType] = [];
  }
  handlers[eventType]!.push(handler);
  logger.info(`[EVENT REGISTRY] Handler registered for ${eventType}`);
}

/**
 * Emit an event to all registered handlers
 * @param eventType The event type
 * @param payload The event payload
 */
export async function emitEvent(
  eventType: EventType,
  payload: EventPayload
) {
  logger.info({ eventType }, `[EVENT] Event emitted: ${eventType}`);

  const eventHandlers = handlers[eventType] || [];
  
  for (const handler of eventHandlers) {
    try {
      await handler(payload);
    } catch (error) {
      logger.error(
        { err: error, eventType },
        `[EVENT] Error executing handler for ${eventType}`
      );
      // Don't rethrow - allow other handlers to execute
    }
  }
}

/**
 * Initialize all default event handlers
 * Call this once on server startup
 */
export function initializeEventHandlers() {
  logger.info("[EVENT SYSTEM] Initializing event handlers");

  // Register core event handlers
  registerHandler("MATTER_CREATED", handleMatterCreated);
  registerHandler("PAYMENT_RECEIVED", handlePaymentReceived);
  registerHandler("STAGE_CHANGED", handleStageChanged);
  registerHandler("MATTER_STAGE_CHANGED", handleStageChanged); // Alias
  registerHandler("INTEREST_CALCULATION", handleInterestCalculation);
  registerHandler("DEBTOR_CREATED", handleDebtorCreated);

  // NOTE: Additional handlers for the following events should be imported and registered:
  // - DEBTOR_STATUS_CHANGED
  // - DOCUMENT_GENERATED
  // - WHATSAPP_MESSAGE_RECEIVED
  // - PAYMENT_ARRANGEMENT_ACCEPTED
  // - PAYMENT_DEFAULTED
  // - MATTER_SETTLED
  // - DISPUTE_RAISED
  // - TASK_COMPLETED

  logger.info("[EVENT SYSTEM] Event handlers initialized");
}

/**
 * Get current handler count (useful for monitoring)
 */
export function getHandlerCount(): Record<EventType, number> {
  const counts: Record<EventType, number> = {} as Record<EventType, number>;
  for (const [eventType, eventHandlers] of Object.entries(handlers)) {
    counts[eventType as EventType] = eventHandlers?.length || 0;
  }
  return counts;
}

export default {
  emitEvent,
  registerHandler,
  initializeEventHandlers,
  getHandlerCount,
};

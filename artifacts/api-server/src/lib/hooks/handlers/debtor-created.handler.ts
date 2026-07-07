/**
 * DEBTOR_CREATED Event Handler
 * Triggered when a new debtor is added to the system
 */

import { logger } from "../../logger";
import { logDebtorRegistered } from "../../activity-log.service";

export interface DebtorCreatedEvent {
  debtorId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  status: string;
  createdById: string;
}

export async function handleDebtorCreated(event: DebtorCreatedEvent) {
  logger.info(
    `[EVENT] DEBTOR_CREATED: ${event.fullName} (${event.debtorId})`
  );

  try {
    await logDebtorRegistered(event.debtorId, event.fullName);

    logger.info(
      {
        debtorId: event.debtorId,
        fullName: event.fullName,
        status: event.status,
        contact: event.whatsapp || event.phone || event.email,
      },
      `[EVENT] New debtor registered in system`
    );

    logger.info(`[EVENT] DEBTOR_CREATED automation complete`);
  } catch (error) {
    logger.error({ err: error }, `[EVENT] Error in DEBTOR_CREATED handler`);
    throw error;
  }
}

/**
 * MATTER_CREATED Event Handler
 * Triggered when a new matter is created
 *
 * Responsibilities:
 * - Generate Letter of Demand (LOD)
 * - Send initial WhatsApp notification
 * - Schedule first reminder (T+7)
 * - Enqueue auto-advance check
 */

import { logger } from "../../logger";
import { enqueueJob } from "../../jobs/dispatcher";
import {
  logMatterAutomationStarted,
  logLodGenerating,
  logReminderScheduled,
  logJobQueued,
} from "../../activity-log.service";
import { isAutomationEnabled } from "../../automation-settings.service";

export interface MatterCreatedEvent {
  matterId: string;
  reference: string;
  debtorId: string;
  stage: string;
  createdById: string;
}

export async function handleMatterCreated(event: MatterCreatedEvent) {
  logger.info(
    `[EVENT] MATTER_CREATED: ${event.reference} (matterId: ${event.matterId})`
  );

  try {
    const automationOn = await isAutomationEnabled(event.matterId);
    if (!automationOn) {
      logger.info(`[EVENT] MATTER_CREATED: automation disabled for ${event.reference}`);
      return;
    }

    await logMatterAutomationStarted(event.debtorId, event.matterId, event.reference);

    // 1. Generate Letter of Demand (WhatsApp LOD notification chains after document job)
    await logLodGenerating(event.debtorId, event.matterId, event.reference);
    await logJobQueued(event.debtorId, event.matterId, "LOD document generation", "document");
    await enqueueJob("document", {
      matterId: event.matterId,
      documentType: "LOD",
      debtorId: event.debtorId,
      reference: event.reference,
      chainWhatsApp: true,
    });
    logger.info(`[EVENT] LOD document generation queued`);

    // 2. Schedule T+7 reminder
    await logReminderScheduled(event.debtorId, event.matterId, event.reference);
    await logJobQueued(event.debtorId, event.matterId, "Payment reminder (T+7)", "reminder");
    await enqueueJob(
      "reminder",
      {
        matterId: event.matterId,
        reminderType: "INITIAL",
        debtorId: event.debtorId,
      },
      { delay: 7 * 24 * 60 * 60 * 1000 }
    );
    logger.info(`[EVENT] T+7 reminder scheduled`);

    // 4. Queue auto-advance check
    await enqueueJob("auto-advance", { matterId: event.matterId });
    logger.info(`[EVENT] Auto-advance check queued`);

    logger.info(`[EVENT] MATTER_CREATED automation complete`);
  } catch (error) {
    logger.error({ err: error }, `[EVENT] Error in MATTER_CREATED handler`);
    throw error;
  }
}

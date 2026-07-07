/**
 * STAGE_CHANGED Event Handler
 * Triggered when a matter's collection stage changes
 */

import { logger } from "../../logger";
import { enqueueJob } from "../../jobs/dispatcher";
import { db, debtorsTable, mattersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logStageChanged, logLodGenerating } from "../../activity-log.service";

export interface StageChangedEvent {
  matterId: string;
  reference: string;
  fromStage: string | null;
  toStage: string;
  changedById: string;
}

export async function handleStageChanged(event: StageChangedEvent) {
  logger.info(
    `[EVENT] STAGE_CHANGED: ${event.reference} (${event.fromStage} → ${event.toStage})`
  );

  try {
    const [matter] = await db
      .select()
      .from(mattersTable)
      .where(eq(mattersTable.id, event.matterId));

    if (matter) {
      await logStageChanged(matter.debtorId, event.matterId, event.reference, event.fromStage, event.toStage);
    }

    // 1. Generate document for new stage
    const docTypeMap: Record<string, string> = {
      LOD: "LOD",
      S129: "S129",
      JUDGMENT: "JUDGMENT",
      EXECUTION: "EXECUTION",
    };

    const docType = docTypeMap[event.toStage] || "GENERAL";
    if (matter) {
      await logLodGenerating(matter.debtorId, event.matterId, event.reference);
    }
    await enqueueJob("document", {
      matterId: event.matterId,
      documentType: docType,
      debtorId: matter?.debtorId,
      reference: event.reference,
    });
    logger.info(`[EVENT] Stage transition document queued`);

    // 2. Send notification
    if (matter) {
      const [debtor] = await db
        .select()
        .from(debtorsTable)
        .where(eq(debtorsTable.id, matter.debtorId));

      if (debtor?.whatsapp) {
        const debtorName = `${debtor.firstName} ${debtor.lastName}`;
        const stageMessages: Record<string, string> = {
          S129: "Your matter has progressed to Summons stage. Legal proceedings may commence.",
          JUDGMENT: "Judgment has been obtained. Please arrange immediate settlement.",
          EXECUTION: "Execution proceedings are underway.",
        };

        const message =
          stageMessages[event.toStage] ||
          `Your matter for ${event.reference} has moved to ${event.toStage} stage.`;

        await enqueueJob("whatsapp", {
          debtorPhone: debtor.whatsapp,
          matterId: event.matterId,
          debtorId: matter.debtorId,
          debtorName,
          message,
          activityContext: "STAGE_NOTIFICATION",
        });
        logger.info(`[EVENT] Stage transition notification queued`);
      }
    }

    // 3. Queue auto-advance check for new stage
    await enqueueJob("auto-advance", { matterId: event.matterId });
    logger.info(`[EVENT] Auto-advance check queued for new stage`);

    logger.info(`[EVENT] STAGE_CHANGED automation complete`);
  } catch (error) {
    logger.error({ err: error }, `[EVENT] Error in STAGE_CHANGED handler`);
    throw error;
  }
}

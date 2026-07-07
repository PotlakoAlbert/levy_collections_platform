/**
 * PAYMENT_RECEIVED Event Handler
 * Triggered when a payment is recorded against a matter
 * 
 * Responsibilities:
 * - Allocate payment across capital/costs/interest
 * - Recalculate interest
 * - Check for stage advancement
 * - Send payment confirmation via WhatsApp
 */

import { logger } from "../../logger";
import { enqueueJob } from "../../jobs/dispatcher";
import { db, debtorsTable, mattersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logDebtorActivity } from "../../activity-log.service";

export interface PaymentReceivedEvent {
  paymentId: string;
  matterId: string;
  amount: number;
  createdById: string;
}

export async function handlePaymentReceived(event: PaymentReceivedEvent) {
  logger.info(
    `[EVENT] PAYMENT_RECEIVED: R${event.amount} for matter ${event.matterId}`
  );

  try {
    // 1. Enqueue payment allocation job
    await enqueueJob("payment", {
      paymentId: event.paymentId,
      matterId: event.matterId,
      amount: event.amount,
    });
    logger.info(`[EVENT] Payment allocation queued`);

    // 2. Recalculate interest
    await enqueueJob("interest", { matterId: event.matterId });
    logger.info(`[EVENT] Interest recalculation queued`);

    // 3. Check for stage advancement
    await enqueueJob("auto-advance", { matterId: event.matterId });
    logger.info(`[EVENT] Auto-advance check queued`);

    // 4. Send payment confirmation
    const [matter] = await db
      .select()
      .from(mattersTable)
      .where(eq(mattersTable.id, event.matterId));

    if (!matter) {
      logger.warn(`[EVENT] Matter not found: ${event.matterId}`);
      return;
    }

    const [debtor] = await db
      .select()
      .from(debtorsTable)
      .where(eq(debtorsTable.id, matter.debtorId));

    const debtorName = debtor ? `${debtor.firstName} ${debtor.lastName}` : "debtor";
    await logDebtorActivity({
      debtorId: matter.debtorId,
      matterId: event.matterId,
      eventType: "PAYMENT_RECEIVED",
      message: `Payment of R${event.amount.toFixed(2)} received for matter ${matter.reference}`,
      status: "COMPLETED",
      payload: { paymentId: event.paymentId, amount: event.amount },
    });

    if (debtor?.whatsapp) {
      await logDebtorActivity({
        debtorId: matter.debtorId,
        matterId: event.matterId,
        eventType: "PAYMENT_CONFIRMATION_SENDING",
        message: `Sending payment confirmation to ${debtorName} via WhatsApp...`,
        status: "IN_PROGRESS",
      });
      await enqueueJob("whatsapp", {
        debtorPhone: debtor.whatsapp,
        matterId: event.matterId,
        debtorId: matter.debtorId,
        debtorName,
        message: `Payment of R${event.amount} received for ${matter.reference}. Thank you. Your updated balance will be confirmed shortly.`,
        activityContext: "PAYMENT_CONFIRMATION",
      });
      logger.info(`[EVENT] Payment confirmation queued`);
    }

    logger.info(`[EVENT] PAYMENT_RECEIVED automation complete`);
  } catch (error) {
    logger.error({ err: error }, `[EVENT] Error in PAYMENT_RECEIVED handler`);
    throw error;
  }
}

import { Job } from "bullmq";
import { db, mattersTable, debtorsTable, communicationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { enqueueJob } from "./dispatcher";
import { logReminderSending } from "../activity-log.service";

/**
 * Reminder worker job
 * Sends payment reminders to debtors via WhatsApp
 */
export async function handleReminderJob(job: Job) {
  logger.info({ ...job.data }, `[REMINDER WORKER] Processing payment reminder`);

  try {
    const { matterId, reminderType } = job.data;

    if (!matterId) {
      logger.warn(`[REMINDER WORKER] No matterId provided`);
      return { success: false, error: "matterId required" };
    }

    // Get matter and debtor details
    const [matter] = await db
      .select()
      .from(mattersTable)
      .where(eq(mattersTable.id, matterId));

    if (!matter) {
      logger.warn({ matterId }, `[REMINDER WORKER] Matter not found`);
      return { success: false, error: "matter not found", matterId };
    }

    const [debtor] = await db
      .select()
      .from(debtorsTable)
      .where(eq(debtorsTable.id, matter.debtorId));

    if (!debtor || !debtor.whatsapp) {
      logger.warn({ matterId }, `[REMINDER WORKER] Debtor or phone not found`);
      return { success: false, error: "debtor phone not found", matterId };
    }

    // Generate reminder message
    const outstanding = parseFloat(matter.capitalArrears) +
      parseFloat(matter.interest) +
      parseFloat(matter.legalCosts) -
      parseFloat(matter.totalPaid);

    const debtorName = `${debtor.firstName} ${debtor.lastName}`.trim();
    const debtorFirstName = debtor.firstName;
    let reminderMessage = "";

    switch (reminderType) {
      case "INITIAL":
        reminderMessage = `Hi ${debtorFirstName}, this is a friendly reminder that you have an outstanding amount of R${outstanding.toFixed(2)} due. Please contact us to arrange payment. Matter ref: ${matter.reference}`;
        break;
      case "SECOND":
        reminderMessage = `${debtorFirstName}, second reminder: Your outstanding debt of R${outstanding.toFixed(2)} is overdue. Please settle immediately to avoid further action. Ref: ${matter.reference}`;
        break;
      case "FINAL":
        reminderMessage = `${debtorFirstName}, final notice: Outstanding amount R${outstanding.toFixed(2)} is seriously overdue. Please contact us urgently to settle or arrange terms. Ref: ${matter.reference}`;
        break;
      default:
        reminderMessage = `Hi ${debtorFirstName}, reminder: Outstanding balance R${outstanding.toFixed(2)}. Please arrange payment. Ref: ${matter.reference}`;
    }

    await logReminderSending(debtor.id, matterId, matter.reference, reminderType || "STANDARD");

    // Queue WhatsApp message
    await enqueueJob("whatsapp", {
      debtorPhone: debtor.whatsapp,
      message: reminderMessage,
      matterId,
      debtorId: debtor.id,
      debtorName,
      activityContext: "REMINDER",
    });

    // Log reminder communication
    await db.insert(communicationsTable).values({
      matterId,
      to: debtor.whatsapp,
      channel: "WHATSAPP",
      body: reminderMessage,
      status: "PENDING",
      createdById: "system",
    });

    logger.info({
      matterId,
      reference: matter.reference,
      debtorPhone: debtor.whatsapp,
      reminderType,
      outstanding: outstanding.toFixed(2),
    }, `[REMINDER WORKER] Reminder queued`);

    return {
      success: true,
      matterId,
      reference: matter.reference,
      reminderType,
      debtorPhone: debtor.whatsapp,
      outstanding: outstanding.toFixed(2),
    };
  } catch (error) {
    logger.error({ err: error }, `[REMINDER WORKER] Error sending reminder`);
    throw error;
  }
}

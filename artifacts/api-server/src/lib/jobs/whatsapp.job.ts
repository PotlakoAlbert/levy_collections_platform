import { Job } from "bullmq";
import { db, communicationsTable, whatsappMessagesTable, debtorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import { whatsappService } from "../whatsapp/whatsapp.service";
import { emitToDebtor } from "../ws";
import { logWhatsAppSending, logWhatsAppSent, logWhatsAppFailed } from "../activity-log.service";

/**
 * WhatsApp message sending worker job
 * Processes queued WhatsApp messages and sends via Meta API
 */
export async function handleWhatsAppJob(job: Job) {
  logger.info({ ...job.data }, `[WHATSAPP WORKER] Processing WhatsApp job`);

  try {
    const { debtorPhone, message, matterId, debtorId, whatsappMessageId, debtorName, activityContext } = job.data;

    if (!debtorPhone || !message) {
      logger.warn(`[WHATSAPP WORKER] Missing required fields`, job.data);
      return { success: false, error: "debtorPhone and message required" };
    }

    let resolvedDebtorId = debtorId;
    let resolvedDebtorName = debtorName;

    if (!resolvedDebtorId || !resolvedDebtorName) {
      const [debtor] = await db
        .select()
        .from(debtorsTable)
        .where(eq(debtorsTable.whatsapp, debtorPhone));
      if (debtor) {
        resolvedDebtorId = debtor.id;
        resolvedDebtorName = `${debtor.firstName} ${debtor.lastName}`;
      }
    }

    if (resolvedDebtorId) {
      const contextLabel = activityContext === "LOD_NOTIFICATION" ? "LOD notification" : activityContext === "BOT_REPLY" ? "bot reply" : "message";
      await logWhatsAppSending(
        resolvedDebtorId,
        matterId || null,
        resolvedDebtorName || "debtor",
        `[${contextLabel}] ${message}`
      );
    }

    const result = await whatsappService.sendMessage(debtorPhone, message);

    if (!result.success) {
      if (whatsappMessageId) {
        await db
          .update(whatsappMessagesTable)
          .set({
            status: "FAILED",
            errorMsg: result.error || "Failed to send",
            updatedAt: new Date(),
          })
          .where(eq(whatsappMessagesTable.id, whatsappMessageId));
      }

      await db.insert(communicationsTable).values({
        matterId: matterId || null,
        to: debtorPhone,
        channel: "WHATSAPP",
        body: message,
        status: "FAILED",
        createdById: "system",
      });

      if (resolvedDebtorId) {
        await logWhatsAppFailed(
          resolvedDebtorId,
          matterId || null,
          resolvedDebtorName || "debtor",
          result.error || "Failed to send"
        );
      }

      logger.warn({
        debtorPhone,
        error: result.error,
      }, `[WHATSAPP WORKER] Failed to send message`);
      throw new Error(result.error || "Failed to send WhatsApp message");
    }

    if (whatsappMessageId) {
      await db
        .update(whatsappMessagesTable)
        .set({
          status: "SENT",
          waMessageId: result.messageId || null,
          errorMsg: null,
          updatedAt: new Date(),
        })
        .where(eq(whatsappMessagesTable.id, whatsappMessageId));

      try {
        if (resolvedDebtorId) {
          emitToDebtor(resolvedDebtorId, "whatsapp_outbound", { id: whatsappMessageId, status: "SENT", waMessageId: result.messageId });
        }
      } catch (e) {
        logger.warn({ e }, "Failed to emit websocket for outbound update");
      }
    } else {
      const [waRow] = await db.insert(whatsappMessagesTable).values({
        matterId: matterId || null,
        debtorId: resolvedDebtorId || null,
        direction: "OUTBOUND",
        messageType: "text",
        content: message,
        waMessageId: result.messageId || null,
        status: "SENT",
        createdById: "system",
      }).returning();

      try {
        if (waRow?.debtorId) {
          emitToDebtor(waRow.debtorId, "whatsapp_outbound", { whatsappMessage: waRow });
        } else if (resolvedDebtorId) {
          emitToDebtor(resolvedDebtorId, "whatsapp_outbound", { whatsappMessage: waRow || null });
        }
      } catch (e) {
        logger.warn({ e }, "Failed to emit websocket for outbound create");
      }
    }

    if (matterId) {
      const [commRow] = await db.insert(communicationsTable).values({
        matterId,
        to: debtorPhone,
        channel: "WHATSAPP",
        body: message,
        sentAt: new Date(),
        status: "SENT",
        createdById: "system",
      }).returning();

      try {
        if (resolvedDebtorId) {
          emitToDebtor(resolvedDebtorId, "communication_sent", { communication: commRow });
        }
      } catch (e) {
        logger.warn({ e }, "Failed to emit websocket for communication_sent");
      }

      logger.info({
        matterId,
        debtorPhone,
        messageId: result.messageId,
        length: message.length,
      }, `[WHATSAPP WORKER] Message sent and logged`);
    } else {
      logger.info({
        debtorPhone,
        messageId: result.messageId,
      }, `[WHATSAPP WORKER] Message sent (no matter tracking)`);
    }

    if (resolvedDebtorId) {
      await logWhatsAppSent(resolvedDebtorId, matterId || null, resolvedDebtorName || "debtor");
    }

    return {
      success: true,
      debtorPhone,
      messageId: result.messageId,
      matterId,
    };
  } catch (error) {
    logger.error({ err: error }, `[WHATSAPP WORKER] Error sending WhatsApp message`);
    throw error;
  }
}

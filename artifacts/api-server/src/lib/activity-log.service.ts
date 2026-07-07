/**
 * Central activity logging for per-debtor automation feedback.
 * Persists to event_logs + communications (SYSTEM channel) and emits WebSocket events.
 */

import { db, eventLogsTable, communicationsTable, debtorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { emitToDebtor } from "./ws";

export type ActivityStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED" | "SCHEDULED" | "ESCALATED";

export interface LogDebtorActivityParams {
  debtorId: string;
  matterId?: string | null;
  eventType: string;
  message: string;
  status?: ActivityStatus;
  payload?: Record<string, unknown>;
  userId?: string;
  emitWs?: boolean;
}

async function resolveDebtorName(debtorId: string): Promise<string> {
  const [debtor] = await db
    .select({ firstName: debtorsTable.firstName, lastName: debtorsTable.lastName })
    .from(debtorsTable)
    .where(eq(debtorsTable.id, debtorId));
  if (!debtor) return "Unknown debtor";
  return `${debtor.firstName} ${debtor.lastName}`.trim();
}

export async function emitDebtorEvent(debtorId: string, eventName: string, data: unknown) {
  try {
    emitToDebtor(debtorId, eventName, data);
  } catch (error) {
    logger.warn({ err: error, debtorId, eventName }, "Failed to emit debtor websocket event");
  }
}

/**
 * Log an automation step for a debtor — visible in UI timeline and event audit trail.
 */
export async function logDebtorActivity(params: LogDebtorActivityParams) {
  const {
    debtorId,
    matterId = null,
    eventType,
    message,
    status = "IN_PROGRESS",
    payload = {},
    userId,
    emitWs = true,
  } = params;

  try {
    const debtorName = await resolveDebtorName(debtorId);

    let eventLog: typeof eventLogsTable.$inferSelect | null = null;
    try {
      const [row] = await db
        .insert(eventLogsTable)
        .values({
          eventType,
          eventSource: "AUTOMATION",
          matterId: matterId || null,
          debtorId,
          userId: userId || null,
          payload: { message, debtorName, ...payload },
          status: status === "FAILED" ? "FAILED" : status === "IN_PROGRESS" ? "PENDING_RETRY" : "COMPLETED",
          processedAt: status === "COMPLETED" || status === "FAILED" ? new Date() : null,
        })
        .returning();
      eventLog = row ?? null;
    } catch (eventLogError) {
      logger.warn({ err: eventLogError, eventType }, "[ACTIVITY] event_logs insert failed — continuing with communications only");
    }

    const [commRow] = await db
      .insert(communicationsTable)
      .values({
        matterId: matterId || null,
        to: debtorName,
        channel: "SYSTEM",
        body: message,
        status,
        sentAt: status === "COMPLETED" ? new Date() : null,
        createdById: "system",
      })
      .returning();

    logger.info(
      { debtorId, matterId, eventType, status, message },
      `[ACTIVITY] ${message}`
    );

    if (emitWs) {
      emitToDebtor(debtorId, "debtor_activity", {
        eventLog,
        communication: commRow,
        message,
        eventType,
        status,
        debtorName,
      });
    }

    return { eventLog, communication: commRow };
  } catch (error) {
    logger.error({ err: error, debtorId, eventType }, "[ACTIVITY] Failed to log debtor activity");
    return null;
  }
}

/** Convenience helpers for common automation messages */
export async function logLodGenerating(debtorId: string, matterId: string, reference: string) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "LOD_GENERATING",
    message: `Generating Letter of Demand for matter ${reference}...`,
    status: "IN_PROGRESS",
    payload: { reference },
  });
}

export async function logLodGenerated(debtorId: string, matterId: string, reference: string, documentId: string) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "LOD_GENERATED",
    message: `Letter of Demand generated for matter ${reference}`,
    status: "COMPLETED",
    payload: { reference, documentId },
  });
}

export async function logLodSending(debtorId: string, matterId: string, reference: string, channel = "WhatsApp") {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "LOD_SENDING",
    message: `Sending Letter of Demand to debtor via ${channel} (matter ${reference})...`,
    status: "IN_PROGRESS",
    payload: { reference, channel },
  });
}

export async function logWhatsAppSending(debtorId: string, matterId: string | null, debtorName: string, preview: string) {
  const shortPreview = preview.length > 60 ? `${preview.slice(0, 60)}...` : preview;
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "WHATSAPP_SENDING",
    message: `Sending reply to debtor ${debtorName}: "${shortPreview}"`,
    status: "IN_PROGRESS",
    payload: { preview: shortPreview },
  });
}

export async function logWhatsAppSent(debtorId: string, matterId: string | null, debtorName: string) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "WHATSAPP_SENT",
    message: `WhatsApp message sent to ${debtorName}`,
    status: "COMPLETED",
  });
}

export async function logWhatsAppFailed(debtorId: string, matterId: string | null, debtorName: string, error: string) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "WHATSAPP_FAILED",
    message: `Failed to send WhatsApp to ${debtorName}: ${error}`,
    status: "FAILED",
    payload: { error },
  });
}

export async function logBotReplyQueued(debtorId: string, matterId: string, debtorName: string, intent: string) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "BOT_REPLY_QUEUED",
    message: `Bot preparing reply to ${debtorName} (intent: ${intent})...`,
    status: "IN_PROGRESS",
    payload: { intent },
  });
}

export async function logBotDraftReady(
  debtorId: string,
  matterId: string,
  debtorName: string,
  preview: string,
  intent: string
) {
  const shortPreview = preview.length > 80 ? `${preview.slice(0, 80)}...` : preview;
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "BOT_DRAFT_READY",
    message: `Bot drafted a reply to ${debtorName} — review before sending: "${shortPreview}"`,
    status: "IN_PROGRESS",
    payload: { intent, preview: shortPreview, fullMessage: preview },
  });
}

export async function logBotTyping(debtorId: string, matterId: string | null, preview?: string) {
  const message = preview ?? "Bot is generating a reply...";
  const activity = await logDebtorActivity({
    debtorId,
    matterId,
    eventType: "BOT_TYPING",
    message,
    status: "IN_PROGRESS",
    payload: { preview },
  });

  await emitDebtorEvent(debtorId, "bot_typing", {
    matterId,
    preview,
    message,
  });

  return activity;
}

export async function logJobQueued(
  debtorId: string,
  matterId: string | null,
  label: string,
  queueName: string
) {
  const activity = await logDebtorActivity({
    debtorId,
    matterId,
    eventType: "JOB_QUEUED",
    message: `${label} queued — processing next in ${queueName} queue`,
    status: "IN_PROGRESS",
    payload: { label, queueName },
  });

  await emitDebtorEvent(debtorId, "job_queued", {
    matterId,
    label,
    queueName,
    status: "QUEUED",
  });

  return activity;
}

export async function logJobStarted(
  debtorId: string,
  matterId: string | null,
  queueName: string,
  jobId: string,
  label: string,
  payload: Record<string, unknown> = {}
) {
  const activity = await logDebtorActivity({
    debtorId,
    matterId,
    eventType: "JOB_STARTED",
    message: `${label} started in ${queueName} queue`,
    status: "IN_PROGRESS",
    payload: { jobId, queueName, label, ...payload },
  });

  await emitDebtorEvent(debtorId, "job_started", {
    matterId,
    jobId,
    queueName,
    label,
    payload,
  });

  return activity;
}

export async function logBotEscalated(debtorId: string, matterId: string, debtorName: string, reason: string) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "BOT_ESCALATED",
    message: `Message from ${debtorName} escalated for human review: ${reason}`,
    status: "ESCALATED",
    payload: { reason },
  });
}

export async function logBotStateChanged(
  debtorId: string,
  matterId: string,
  fromState: string | null,
  toState: string,
  reason?: string
) {
  const stateDescriptions: Record<string, string> = {
    INITIAL: "Conversation started",
    AWAITING_RESPONSE: "Waiting for debtor response",
    NEGOTIATING: "Negotiating payment terms",
    ARRANGEMENT_MADE: "Payment arrangement agreed",
    ESCALATED: "Escalated to human review",
  };

  const description = stateDescriptions[toState] || toState;
  const reasonText = reason ? ` — ${reason}` : "";

  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "BOT_STATE_CHANGED",
    message: `Bot conversation state: ${description}${reasonText}`,
    status: "COMPLETED",
    payload: { fromState: fromState || "new", toState, reason },
  });
}

export async function logReminderScheduled(debtorId: string, matterId: string, reference: string) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "REMINDER_SCHEDULED",
    message: `Payment reminder scheduled for matter ${reference} (in 7 days)`,
    status: "SCHEDULED",
    payload: { reference },
  });
}

export async function logReminderSending(debtorId: string, matterId: string, reference: string, reminderType: string) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "REMINDER_SENDING",
    message: `Sending ${reminderType} payment reminder to debtor for matter ${reference}...`,
    status: "IN_PROGRESS",
    payload: { reference, reminderType },
  });
}

export async function logDebtorRegistered(debtorId: string, fullName: string) {
  return logDebtorActivity({
    debtorId,
    eventType: "DEBTOR_REGISTERED",
    message: `Debtor ${fullName} registered in system`,
    status: "COMPLETED",
    payload: { fullName },
  });
}

export async function logMatterAutomationStarted(debtorId: string, matterId: string, reference: string) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "MATTER_AUTOMATION_STARTED",
    message: `Automation started for matter ${reference}: LOD generation, WhatsApp notification, and reminders`,
    status: "IN_PROGRESS",
    payload: { reference },
  });
}

export async function logStageChanged(
  debtorId: string,
  matterId: string,
  reference: string,
  fromStage: string | null,
  toStage: string
) {
  return logDebtorActivity({
    debtorId,
    matterId,
    eventType: "STAGE_CHANGED",
    message: `Matter ${reference} moved from ${fromStage ?? "new"} to ${toStage} stage`,
    status: "COMPLETED",
    payload: { reference, fromStage, toStage },
  });
}

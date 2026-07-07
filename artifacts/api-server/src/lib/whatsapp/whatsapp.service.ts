/**
 * WhatsApp Service Layer
 * Handles sending/receiving WhatsApp messages via Meta WhatsApp Business API
 *
 * CORE FEATURES:
 * - Webhook verification & incoming message handling
 * - AI intent classification (debtor message → action mapping)
 * - Automated bot responses with escalation handling
 * - Conversation state tracking (INITIAL → NEGOTIATING → ARRANGEMENT_MADE)
 * - Real-time activity logging to event_logs & communications tables
 *
 * INTENT → ACTION MAPPING:
 * See: lib/whatsapp-intent-mapping.md for complete documentation including:
 * - 8 debtor intents (PAYMENT_OFFER, PAYMENT_AGREED, DISPUTE_CLAIM, etc.)
 * - Bot responses for each intent
 * - State transitions and follow-up actions
 * - Settlement confirmation flow
 * - Escalation rules (disputes, legal threats, blocked contact)
 *
 * INTEGRATES WITH:
 * - Meta WhatsApp Business API for message delivery
 * - AI Service (Phase 3) for intelligent response generation
 * - Bot States (Phase 2 schema) for conversation tracking
 * - Communications table for message logging
 * - Activity Log Service for timeline events
 * - Job Dispatcher for document generation jobs
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 * - WHATSAPP_PHONE_NUMBER_ID: WhatsApp phone number ID (from Meta)
 * - WHATSAPP_BUSINESS_ACCOUNT_ID: Business account ID (from Meta)
 * - WHATSAPP_ACCESS_TOKEN: API access token (from Meta)
 * - WHATSAPP_WEBHOOK_VERIFY_TOKEN: Custom webhook verification token
 * - WHATSAPP_API_VERSION: Graph API version (default: v19.0)
 * - WHATSAPP_API_URL: Base API URL (default: https://graph.instagram.com)
 * - WHATSAPP_MODE: "real" or "mock" for testing without API keys
 *
 * For testing without API keys, set WHATSAPP_MODE=mock
 */

import { logger } from "../logger";
import { emitToDebtor } from "../ws";
import { aiService } from "../ai/ai.service";
import {
  db,
  debtorsTable,
  mattersTable,
  communicationsTable,
  whatsappMessagesTable,
  botConversationStatesTable,
  webhookEventsTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { enqueueJob } from "../jobs/dispatcher";
import { logBotReplyQueued, logBotEscalated, logBotDraftReady, logJobQueued, logBotTyping, logBotStateChanged } from "../activity-log.service";
import {
  isBotAutoReplyEnabled,
  setPendingBotDraft,
} from "../automation-settings.service";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface WhatsAppIncomingMessage {
  from: string; // Phone number that sent message
  body: string; // Message text
  messageId: string; // Unique message ID
  timestamp: number; // Unix timestamp
  matterContext?: {
    matterId?: string;
    debtorId?: string;
  };
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface BotResponse {
  messageText: string;
  intent: string;
  confidence: number;
  shouldEscalate: boolean;
  escalationReason?: string;
  nextAction?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// WHATSAPP SERVICE CLASS
// ============================================================================

class WhatsAppService {
  private readonly phoneNumberId: string | null;
  private readonly businessAccountId: string | null;
  private readonly accessToken: string | null;
  private readonly webhookVerifyToken: string | null;
  private readonly apiVersion: string;
  private readonly apiUrl: string;
  private readonly mode: "real" | "mock";

  constructor() {
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || null;
    this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || null;
    this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || null;
    this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || null;
    this.apiVersion = process.env.WHATSAPP_API_VERSION || "v19.0";
    this.apiUrl = process.env.WHATSAPP_API_URL || "https://graph.instagram.com";
    
    // Determine mode: accept "real", "production", or "mock"
    const rawMode = process.env.WHATSAPP_MODE || "real";
    this.mode = (rawMode === "production" || rawMode === "real" ? "real" : "mock") as "real" | "mock";

    // Production should not use mock mode
    const isProduction = process.env.NODE_ENV === "production";
    if (isProduction && this.mode === "mock") {
      logger.error(
        "Mock WhatsApp mode detected in production. Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_WEBHOOK_VERIFY_TOKEN, and WHATSAPP_MODE=production"
      );
    }

    logger.info(
      {
        mode: this.mode,
        hasPhoneNumberId: !!this.phoneNumberId,
        hasAccessToken: !!this.accessToken,
        hasWebhookToken: !!this.webhookVerifyToken,
      },
      "WhatsApp Service initialized"
    );
  }

  /**
   * WEBHOOK VERIFICATION
   * Meta sends GET request to verify webhook during setup
   * Must respond with challenge token
   */
  verifyWebhook(
    token: string,
    challenge: string
  ): { valid: boolean; challenge?: string } {
    if (token === this.webhookVerifyToken) {
      logger.info("WhatsApp webhook verified");
      return { valid: true, challenge };
    }

    logger.warn(
      { providedToken: token, expectedToken: this.webhookVerifyToken },
      "WhatsApp webhook verification failed"
    );
    return { valid: false };
  }

  /**
   * HANDLE INCOMING WEBHOOK
   * Parse webhook payload from Meta and generate bot response
   */
  async handleIncomingWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      await this.persistWebhookPayload(payload);

      // Extract messages from webhook
      const messages = this.extractMessagesFromWebhook(payload);

      for (const message of messages) {
        const matterContext = await this.resolveMatterContext(message.from);
        const enrichedMessage: WhatsAppIncomingMessage = {
          ...message,
          matterContext: matterContext || undefined,
        };

        logger.info(
          { from: message.from, messageId: message.messageId },
          "Processing incoming WhatsApp message"
        );

        if (matterContext?.debtorId && matterContext?.matterId) {
          await logBotTyping(matterContext.debtorId, matterContext.matterId);
        }

        // Generate bot response using AI
        const response = await this.generateBotResponse(enrichedMessage);

        // Queue response back to debtor. In mock mode send directly
        // to avoid requiring Redis / BullMQ for local testing.
        if (response.shouldEscalate) {
          logger.warn(
            { from: message.from, reason: response.escalationReason },
            "WhatsApp message escalated to human review"
          );
          if (matterContext?.debtorId && matterContext?.matterId) {
            const debtorName = await this.resolveDebtorName(matterContext.debtorId);
            await logBotEscalated(
              matterContext.debtorId,
              matterContext.matterId,
              debtorName,
              response.escalationReason || "Requires human review"
            );
          }
        } else if (matterContext?.debtorId && matterContext?.matterId) {
          const debtorName = await this.resolveDebtorName(matterContext.debtorId);
          const autoReply = await isBotAutoReplyEnabled(matterContext.matterId);

          if (autoReply) {
            await logBotReplyQueued(
              matterContext.debtorId,
              matterContext.matterId,
              debtorName,
              response.intent
            );
            await logJobQueued(
              matterContext.debtorId,
              matterContext.matterId,
              "Bot reply",
              "whatsapp"
            );

            await enqueueJob("whatsapp", {
              debtorPhone: message.from,
              message: response.messageText,
              matterId: matterContext.matterId,
              debtorId: matterContext.debtorId,
              debtorName,
              activityContext: "BOT_REPLY",
            });
          } else {
            await setPendingBotDraft(matterContext.matterId, matterContext.debtorId, {
              messageText: response.messageText,
              intent: response.intent,
              debtorPhone: message.from,
              createdAt: new Date().toISOString(),
            });
            await logBotDraftReady(
              matterContext.debtorId,
              matterContext.matterId,
              debtorName,
              response.messageText,
              response.intent
            );
          }
        } else {
          await enqueueJob("whatsapp", {
            debtorPhone: message.from,
            message: response.messageText,
            matterId: matterContext?.matterId,
            debtorId: matterContext?.debtorId,
            activityContext: "BOT_REPLY",
          });
        }

        // Update bot state (Phase 2 schema)
        await this.updateBotState(enrichedMessage, response);

        // Log to communications table
        await this.logCommunication(enrichedMessage, response);
      }
    } catch (error) {
      logger.error({ error, payload }, "Failed to handle WhatsApp webhook");
      throw error;
    }
  }

  /**
   * SEND MESSAGE
   * Send WhatsApp message to debtor
   */
  async sendMessage(
    phoneNumber: string,
    messageText: string
  ): Promise<SendMessageResult> {
    try {
      if (this.mode === "mock") {
        return this.mockSendMessage(phoneNumber, messageText);
      }

      if (!this.phoneNumberId || !this.accessToken) {
        throw new Error("WhatsApp credentials not configured");
      }

      const url = `${this.apiUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;
      const body = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: phoneNumber,
        type: "text",
        text: { body: messageText },
      };
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const isDev = process.env.NODE_ENV !== "production";
        if (isDev && (response.status === 401 || response.status === 403)) {
          logger.warn(
            { status: response.status, phoneNumber },
            "WhatsApp API auth failed in development — falling back to mock send"
          );
          return this.mockSendMessage(phoneNumber, messageText);
        }
        throw new Error(
          `WhatsApp API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as any;
      logger.info(
        { messageId: data.messages?.[0]?.id, to: phoneNumber },
        "WhatsApp message sent"
      );

      return {
        success: true,
        messageId: data.messages?.[0]?.id,
      };
    } catch (error) {
      const isDev = process.env.NODE_ENV !== "production";
      if (isDev) {
        logger.warn(
          { error, phoneNumber },
          "WhatsApp send failed in development — falling back to mock send"
        );
        return this.mockSendMessage(phoneNumber, messageText);
      }
      logger.error(
        { error, phoneNumber },
        "Failed to send WhatsApp message"
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ========================================================================
  // PRIVATE HELPER METHODS
  // ========================================================================

  private extractMessagesFromWebhook(
    payload: WhatsAppWebhookPayload
  ): WhatsAppIncomingMessage[] {
    const messages: WhatsAppIncomingMessage[] = [];

    if (!payload.entry) return messages;

    for (const entry of payload.entry) {
      if (!entry.changes) continue;

      for (const change of entry.changes) {
        if (!change.value.messages) continue;

        for (const msg of change.value.messages) {
          if (msg.type === "text" && msg.text?.body) {
            messages.push({
              from: msg.from,
              body: msg.text.body,
              messageId: msg.id,
              timestamp: Number.parseInt(msg.timestamp, 10) * 1000,
            });
          }
        }
      }
    }

    return messages;
  }

  private async generateBotResponse(
    message: WhatsAppIncomingMessage
  ): Promise<BotResponse> {
    try {
      // Use AI to classify debtor intent
      const intentResult = await aiService.classifyDebtorIntent(message.body, {
        debtorName: "Debtor",
      });

      let messageText = "";
      let shouldEscalate = false;
      let escalationReason = undefined;
      let nextAction = undefined;

      // =========================================================================
      // INTENT → ACTION MAPPING
      // Maps debtor intent to bot response, state transition, and follow-up action
      // See: lib/whatsapp-intent-mapping.md for complete documentation
      // =========================================================================

      switch (intentResult.intent) {
        // ─────────────────────────────────────────────────────────────────────
        // PAYMENT_OFFER: Debtor offers payment ("I can pay R500/month")
        // State: INITIAL/AWAITING_RESPONSE → NEGOTIATING
        // Action: Generate arrangement proposal document
        // Outcome: Arrangement proposal sent, awaits debtor confirmation
        // ─────────────────────────────────────────────────────────────────────
        case "PAYMENT_OFFER":
          messageText =
            "Thank you for your offer. Let me check your account details and get back to you shortly with a formal arrangement.";
          nextAction = "SEND_ARRANGEMENT_PROPOSAL";
          break;

        // ─────────────────────────────────────────────────────────────────────
        // NEGOTIATION_REQUEST: Debtor requests to discuss terms
        // State: INITIAL/AWAITING_RESPONSE → NEGOTIATING
        // Action: Ask for debtor's offer (await response)
        // Outcome: Conversation continues, waiting for PAYMENT_OFFER
        // ─────────────────────────────────────────────────────────────────────
        case "NEGOTIATION_REQUEST":
          messageText =
            "I'd be happy to discuss payment terms with you. What amount can you comfortably afford monthly?";
          nextAction = "AWAIT_DEBTOR_OFFER";
          break;

        // ─────────────────────────────────────────────────────────────────────
        // PAYMENT_AGREED: Debtor confirms arrangement ("I accept")
        // State: NEGOTIATING → ARRANGEMENT_MADE
        // Action: Generate formal agreement document
        // Outcome: ✅ SETTLEMENT REACHED — escalated to payments/legal team
        // ─────────────────────────────────────────────────────────────────────
        case "PAYMENT_AGREED":
          messageText =
            "Excellent! I'm sending you the formal agreement. Please confirm receipt and sign digitally.";
          nextAction = "SEND_AGREEMENT";
          break;

        // ─────────────────────────────────────────────────────────────────────
        // DISPUTE_CLAIM: Debtor denies debt validity (⚠️ ESCALATION)
        // State: any → ESCALATED
        // Action: None (escalated to human legal review)
        // Outcome: ⏸️ Bot automation paused, legal team investigates
        // ─────────────────────────────────────────────────────────────────────
        case "DISPUTE_CLAIM":
          messageText =
            "I see you're disputing this debt. Please provide details of your dispute, and we'll review it immediately.";
          shouldEscalate = true;
          escalationReason = "Debtor disputes debt validity";
          break;

        // ─────────────────────────────────────────────────────────────────────
        // INSUFFICIENT_FUNDS: Debtor claims can't afford proposed amount
        // State: NEGOTIATING → NEGOTIATING (continue negotiation)
        // Action: Request revised offer (lower amount)
        // Outcome: Renegotiation loop back to PAYMENT_OFFER
        // ─────────────────────────────────────────────────────────────────────
        case "INSUFFICIENT_FUNDS":
          messageText =
            "I understand you're facing financial constraints. Let's work out an arrangement you can realistically manage.";
          nextAction = "NEGOTIATE_LOWER_AMOUNT";
          break;

        // ─────────────────────────────────────────────────────────────────────
        // BLOCKED_CONTACT: Debtor refuses contact (⚠️ COMPLIANCE ESCALATION)
        // State: any → ESCALATED
        // Action: None (WhatsApp automation disabled, legal channels only)
        // Outcome: ⏸️ Contact blocked, matter proceeds via email/physical mail
        // ─────────────────────────────────────────────────────────────────────
        case "BLOCKED_CONTACT":
          messageText =
            "I notice you've asked not to be contacted. Please note we will continue via other channels as required by law.";
          shouldEscalate = true;
          escalationReason = "Debtor refused contact";
          break;

        // ─────────────────────────────────────────────────────────────────────
        // LEGAL_THREAT: Debtor mentions legal action (⚠️ ESCALATION)
        // State: any → ESCALATED
        // Action: None (escalated to legal counsel)
        // Outcome: ⏸️ Case prepared for litigation/settlement negotiation
        // ─────────────────────────────────────────────────────────────────────
        case "LEGAL_THREAT":
          messageText =
            "I see you're considering legal options. We prefer a settlement. Let's discuss what we can offer.";
          shouldEscalate = true;
          escalationReason = "Debtor mentioned legal action";
          break;

        // ─────────────────────────────────────────────────────────────────────
        // DEFAULT: Unknown intent / generic acknowledgment
        // State: any → AWAITING_RESPONSE (no state change)
        // Action: None (ask for clarification)
        // Outcome: Bot waits for next message (loop)
        // ─────────────────────────────────────────────────────────────────────
        default:
          messageText =
            "Thank you for your message. How can I assist you today? Are you able to make a payment or would you like to discuss an arrangement?";
      }

      return {
        messageText,
        intent: intentResult.intent,
        confidence: intentResult.confidence,
        shouldEscalate,
        escalationReason,
        nextAction,
      };
    } catch (error) {
      logger.error(
        { error, messageBody: message.body },
        "Failed to generate bot response"
      );

      // Fallback response on error
      return {
        messageText:
          "Thank you for your message. Our team will review this shortly.",
        intent: "UNKNOWN",
        confidence: 0,
        shouldEscalate: true,
        escalationReason: "Failed to process message automatically",
      };
    }
  }

  private async updateBotState(
    message: WhatsAppIncomingMessage,
    response: BotResponse
  ): Promise<void> {
    try {
      const matterId = message.matterContext?.matterId;
      const debtorId = message.matterContext?.debtorId;
      if (!matterId || !debtorId) return;

      const [existingState] = await db
        .select()
        .from(botConversationStatesTable)
        .where(eq(botConversationStatesTable.matterId, matterId));

      let existingContext: Record<string, unknown> = {};
      if (existingState?.context) {
        try {
          existingContext = JSON.parse(existingState.context);
        } catch {
          existingContext = {};
        }
      }

      let nextState = "AWAITING_RESPONSE";
      if (response.shouldEscalate) {
        nextState = "ESCALATED";
      } else if (response.nextAction === "AWAIT_DEBTOR_OFFER") {
        nextState = "NEGOTIATING";
      }

      const serializedContext = JSON.stringify({
        ...existingContext,
        lastIntent: response.intent,
        confidence: response.confidence,
        nextAction: response.nextAction || null,
        escalationReason: response.escalationReason || null,
        messageId: message.messageId,
      });

      if (!existingState) {
        await db.insert(botConversationStatesTable).values({
          matterId,
          debtorId,
          state: nextState,
          context: serializedContext,
          lastMessageAt: new Date(message.timestamp),
          lastBotMessageAt: response.shouldEscalate ? null : new Date(),
          messageCount: "1",
          escalationReason: response.escalationReason || null,
        });
        // Log state creation
        await logBotStateChanged(
          debtorId,
          matterId,
          null,
          nextState,
          response.intent
        );
        return;
      }

      const currentCount = Number.parseInt(existingState.messageCount || "0", 10);
      // Log state change only if state actually changed
      if (existingState.state !== nextState) {
        await logBotStateChanged(
          debtorId,
          matterId,
          existingState.state,
          nextState,
          response.intent
        );
      }
      
      await db
        .update(botConversationStatesTable)
        .set({
          state: nextState,
          context: serializedContext,
          lastMessageAt: new Date(message.timestamp),
          lastBotMessageAt: response.shouldEscalate ? existingState.lastBotMessageAt : new Date(),
          messageCount: String(currentCount + 1),
          escalationReason: response.escalationReason || null,
        })
        .where(eq(botConversationStatesTable.matterId, matterId));
    } catch (error) {
      logger.error({ error }, "Failed to update bot state");
    }
  }

  private async logCommunication(
    message: WhatsAppIncomingMessage,
    response: BotResponse
  ): Promise<void> {
    try {
      const matterId = message.matterContext?.matterId || null;
      const debtorId = message.matterContext?.debtorId || null;
      const [commRow] = await db.insert(communicationsTable).values({
        matterId,
        to: "SYSTEM_WHATSAPP_WEBHOOK",
        channel: "WHATSAPP",
        body: message.body,
        sentAt: new Date(message.timestamp),
        status: "DELIVERED",
        createdById: "system",
      }).returning();

      const [waRow] = await db.insert(whatsappMessagesTable).values({
        matterId,
        debtorId,
        direction: "INBOUND",
        messageType: "text",
        content: message.body,
        waMessageId: message.messageId,
        status: "DELIVERED",
        createdById: "system",
      }).returning();

      // Broadcast via WebSocket to any connected clients for this debtor
      try {
        if (debtorId) {
          emitToDebtor(debtorId, "whatsapp_inbound", {
            communication: commRow || null,
            whatsappMessage: waRow || null,
          });
        }
      } catch (err) {
        logger.warn({ err }, "Failed to notify WebSocket clients for inbound WhatsApp");
      }

      logger.info(
        {
          matterId,
          debtorId,
          from: message.from,
          messageId: message.messageId,
          intent: response.intent,
          escalated: response.shouldEscalate,
        },
        "Logged inbound WhatsApp communication"
      );
    } catch (error) {
      logger.error({ error }, "Failed to log communication");
    }
  }

  private async persistWebhookPayload(payload: WhatsAppWebhookPayload): Promise<void> {
    try {
      const firstMessage = this.extractMessagesFromWebhook(payload)[0];
      const matterContext = firstMessage
        ? await this.resolveMatterContext(firstMessage.from)
        : null;

      await db.insert(webhookEventsTable).values({
        source: "WHATSAPP",
        eventType: firstMessage ? "message" : "status_or_other",
        debtorId: matterContext?.debtorId ?? null,
        matterId: matterContext?.matterId ?? null,
        rawPayload: payload as unknown as Record<string, unknown>,
        signatureValid: true,
        processed: false,
        idempotencyKey: firstMessage?.messageId ?? `webhook-${Date.now()}`,
      });
    } catch (error) {
      logger.warn({ error }, "Failed to persist WhatsApp webhook payload");
    }
  }

  private async resolveDebtorName(debtorId: string): Promise<string> {
    const [debtor] = await db
      .select({ firstName: debtorsTable.firstName, lastName: debtorsTable.lastName })
      .from(debtorsTable)
      .where(eq(debtorsTable.id, debtorId));
    if (!debtor) return "debtor";
    return `${debtor.firstName} ${debtor.lastName}`.trim();
  }

  private async resolveMatterContext(
    phone: string
  ): Promise<{ matterId: string; debtorId: string } | null> {
    const [debtor] = await db
      .select()
      .from(debtorsTable)
      .where(eq(debtorsTable.whatsapp, phone));

    if (!debtor) return null;

    const [activeMatter] = await db
      .select()
      .from(mattersTable)
      .where(and(eq(mattersTable.debtorId, debtor.id), eq(mattersTable.status, "ACTIVE")));

    const matter =
      activeMatter ||
      (await db.select().from(mattersTable).where(eq(mattersTable.debtorId, debtor.id)))[0];

    if (!matter) return null;
    return { matterId: matter.id, debtorId: debtor.id };
  }

  // ========================================================================
  // MOCK IMPLEMENTATIONS
  // ========================================================================

  private mockSendMessage(
    phoneNumber: string,
    messageText: string
  ): SendMessageResult {
    const mockMessageId = `wamid.${Date.now()}`;
    logger.info(
      {
        mode: "mock",
        to: phoneNumber,
        messageId: mockMessageId,
        preview: messageText.substring(0, 50),
      },
      "Mock WhatsApp message sent"
    );

    return {
      success: true,
      messageId: mockMessageId,
    };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const whatsappService = new WhatsAppService();

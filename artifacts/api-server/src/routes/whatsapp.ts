/**
 * WhatsApp Webhook Routes
 * Handles webhook endpoints for WhatsApp Business API
 *
 * Endpoints:
 * - GET /api/whatsapp/webhook - Webhook verification (required by Meta)
 * - POST /api/whatsapp/webhook - Receive incoming messages
 * - POST /api/test-whatsapp-send - Test sending WhatsApp message
 * - GET /api/whatsapp-info - WhatsApp service status
 */

import { Router, type IRouter, Request, Response, type NextFunction } from "express";
import { whatsappService, type WhatsAppWebhookPayload } from "../lib/whatsapp/whatsapp.service";
import { logger } from "../lib/logger";
import { getJobProcessingMode } from "../lib/queue";

const router: IRouter = Router();

// Log all requests to this router
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log("=== WHATSAPP ROUTER REQUEST ===");
  console.log("Method:", req.method);
  console.log("Path:", req.path);
  console.log("Full URL:", req.originalUrl);
  next();
});

// ============================================================================
// WEBHOOK ENDPOINTS (Required by Meta)
// ============================================================================

/**
 * GET /api/whatsapp/webhook
 * Meta calls this to verify the webhook during setup
 * Must respond with challenge if token matches
 */
router.get("/whatsapp/webhook", (req: Request, res: Response) => {
  console.log("=== WEBHOOK VERIFICATION REQUEST ===");
  console.log("Full URL:", req.originalUrl);
  console.log("Query object:", req.query);
  console.log("Request headers:", req.headers);

  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  console.log("VERIFY_TOKEN from env:", VERIFY_TOKEN);

  // Try both formats: with dots and with underscores
  let mode = (req.query["hub.mode"] || req.query.hub_mode) as string;
  let token = (req.query["hub.verify_token"] || req.query.hub_verify_token) as string;
  let challenge = (req.query["hub.challenge"] || req.query.hub_challenge) as string;

  console.log("MODE:", mode);
  console.log("TOKEN:", token);
  console.log("CHALLENGE:", challenge);
  console.log("EXPECTED TOKEN:", VERIFY_TOKEN);

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("❌ Webhook verification failed");
  console.log("Mode match:", mode === "subscribe");
  console.log("Token match:", token === VERIFY_TOKEN);
  return res.sendStatus(403);
});

/**
 * POST /api/whatsapp/webhook
 * Meta sends incoming messages and status updates here
 * Process messages and respond with AI bot
 */
router.post("/whatsapp/webhook", async (req: Request, res: Response) => {
  try {
    const payload: WhatsAppWebhookPayload = req.body;

    // Validate payload structure
    if (!payload.entry || payload.entry.length === 0) {
      logger.warn({ payload }, "Invalid WhatsApp webhook payload");
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    // Log incoming webhook
    logger.info(
      {
        entries: payload.entry.length,
        changes: payload.entry[0]?.changes?.length || 0,
      },
      "Received WhatsApp webhook"
    );

    // Process webhook asynchronously (respond immediately to Meta)
    // This prevents timeout and allows processing to continue
    whatsappService.handleIncomingWebhook(payload).catch((error) => {
      logger.error({ error }, "Error handling WhatsApp webhook");
    });

    // Respond immediately with 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error({ error }, "Error processing WhatsApp webhook");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

// ============================================================================
// TEST ENDPOINTS (For development)
// ============================================================================

/**
 * POST /api/test-whatsapp-send
 * Test sending a WhatsApp message to a debtor
 * Request body: { phoneNumber: "+27123456789", message: "Test message" }
 */
router.post("/test-whatsapp-send", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      res.status(400).json({
        error: "phoneNumber and message required",
      });
      return;
    }

    const result = await whatsappService.sendMessage(phoneNumber, message);

    res.json({
      success: result.success,
      result,
      message: result.success
        ? "WhatsApp message sent successfully"
        : "Failed to send WhatsApp message",
    });
  } catch (error) {
    logger.error({ error }, "Error sending test WhatsApp message");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * POST /api/test-whatsapp-webhook
 * Test webhook payload processing (simulates incoming message from debtor)
 * Use this to test the bot without needing actual WhatsApp message
 */
router.post("/test-whatsapp-webhook", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, messageText } = req.body;

    if (!phoneNumber || !messageText) {
      res.status(400).json({
        error: "phoneNumber and messageText required",
      });
      return;
    }

    // Create mock webhook payload
    const mockPayload: WhatsAppWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "test-entry",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                messages: [
                  {
                    from: phoneNumber,
                    id: `test_${Date.now()}`,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    type: "text",
                    text: {
                      body: messageText,
                    },
                  },
                ],
              },
              field: "messages",
            },
          ],
        },
      ],
    };

    // Process webhook
    await whatsappService.handleIncomingWebhook(mockPayload);

    res.json({
      success: true,
      message: "Webhook processed successfully",
      input: { phoneNumber, messageText },
      note: "Bot processed message and may have sent a response",
    });
  } catch (error) {
    logger.error({ error }, "Error processing test webhook");
    res.status(500).json({ error: String(error) });
  }
});

/**
 * GET /api/whatsapp-info
 * Check WhatsApp service status and configuration
 */
router.get("/whatsapp-info", (req: Request, res: Response) => {
  try {
    const hasPhoneNumberId = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
    const hasAccessToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
    const hasWebhookToken = !!process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const mode = process.env.WHATSAPP_MODE || "real";

    res.json({
      service: "WhatsApp Bot Engine",
      status: "ready",
      mode,
      jobProcessingMode: getJobProcessingMode(),
      configuration: {
        hasPhoneNumberId,
        hasAccessToken,
        hasWebhookToken,
      },
      endpoints: {
        webhook: {
          GET: "/api/whatsapp/webhook (for Meta verification)",
          POST: "/api/whatsapp/webhook (for incoming messages)",
        },
        test: [
          "POST /api/test-whatsapp-send (send test message)",
          "POST /api/test-whatsapp-webhook (simulate incoming message)",
        ],
      },
      capabilities: [
        "Receive messages from WhatsApp",
        "Classify debtor intent (Phase 3 AI)",
        "Generate intelligent responses",
        "Send responses to debtors",
        "Track conversation state",
      ],
      readyForProduction: mode === "real" && hasPhoneNumberId && hasAccessToken,
      nextSteps:
        mode === "real"
          ? ["Production ready - webhook endpoint at /api/whatsapp/webhook"]
          : [
              "Set WHATSAPP_MODE=real in .env",
              "Add WHATSAPP_PHONE_NUMBER_ID",
              "Add WHATSAPP_ACCESS_TOKEN",
              "Add WHATSAPP_WEBHOOK_VERIFY_TOKEN",
              "Setup Meta webhook at dashboard.whatsapp.com",
            ],
    });
  } catch (error) {
    logger.error({ error }, "Error getting WhatsApp info");
    res.status(500).json({ error: String(error) });
  }
});

export default router;

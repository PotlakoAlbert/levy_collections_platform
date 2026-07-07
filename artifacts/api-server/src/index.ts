import app from "./app";
import { logger } from "./lib/logger";
import {
  setupQueueEventListeners,
  cleanupQueues,
  initializeQueueMode,
  getJobProcessingMode,
} from "./lib/queue";
import { initializeWorkers, shutdownWorkers } from "./lib/jobs";
import { initializeEventHandlers } from "./lib/hooks/event-hooks";
import { initializeCronJobs, stopCronJobs } from "./lib/cron";
import { initWebsocket } from "./lib/ws";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  try {
    initWebsocket(server);
    logger.info("✓ WebSocket server initialized");
  } catch (err) {
    logger.warn({ err }, "Failed to initialize WebSocket server");
  }

  initializeEventHandlers();

  try {
    const mode = await initializeQueueMode();
    logger.info({
      jobMode: mode,
      whatsappMode: process.env.WHATSAPP_MODE || "real",
      aiProvider: process.env.AI_PROVIDER || "mock",
    }, "Job infrastructure mode selected");

    if (mode === "bullmq") {
      setupQueueEventListeners();
      await initializeWorkers();
      logger.info("✓ BullMQ workers initialized");
    } else {
      logger.info("✓ Inline job processing active — automations run immediately without Redis workers");
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to initialize job infrastructure");
    process.exit(1);
  }

  initializeCronJobs();
  logger.info({
    cron: true,
    jobMode: getJobProcessingMode(),
  }, "✓ Cron jobs initialized");
});

process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, shutting down gracefully...");
  server.close(async () => {
    stopCronJobs();
    await shutdownWorkers();
    await cleanupQueues();
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, shutting down gracefully...");
  server.close(async () => {
    stopCronJobs();
    await shutdownWorkers();
    await cleanupQueues();
    process.exit(0);
  });
});

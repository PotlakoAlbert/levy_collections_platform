import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";
import { logger } from "./logger";
import { logJobStarted } from "./activity-log.service";

type RedisConnection = { host: string; port: number; password?: string; username?: string };

function normalizeRedisUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/^['"]|['"]$/g, "");
  const match = /(?:rediss?:|redis:)\/\/[^^\s"']+/i.exec(trimmed);
  return (match?.[0] ?? trimmed).trim();
}

export const buildRedisConnection = (): { connection: any; info: any } => {
  const rawUrl = process.env.REDIS_URL;
  const normalized = rawUrl ? normalizeRedisUrl(rawUrl) : "";
  const wrapperIncludesTls = rawUrl ? rawUrl.includes("--tls") || rawUrl.includes(" -tls") : false;

  if (!normalized) {
    logger.warn("REDIS_URL not configured, using localhost:6379");
    return { connection: { host: "localhost", port: 6379 }, info: { host: "localhost", port: 6379 } };
  }

  try {
    let normalizedForUrl = normalized;
    if (wrapperIncludesTls || /upstash\.io/i.test(normalized)) {
      normalizedForUrl = normalized.replace(/^redis:\/\//i, "rediss://");
    }

    const urlObj = new URL(normalizedForUrl);
    const protocol = urlObj.protocol;
    const host = urlObj.hostname;
    const port = urlObj.port ? Number(urlObj.port) : 6379;
    const password = urlObj.password ? decodeURIComponent(urlObj.password) : undefined;
    const username = urlObj.username ? decodeURIComponent(urlObj.username) : undefined;

    const ioredisOptions: any = {
      host,
      port,
      password,
      username,
      maxRetriesPerRequest: null,
      connectTimeout: 10000,
      family: 4,
      enableAutoPipelining: false,
      reconnectOnError: (err: any) => {
        const msg = String(err);
        if (msg.includes("READONLY") || msg.includes("ETIMEDOUT")) return true;
        return false;
      },
    };

    if (protocol === "rediss:" || wrapperIncludesTls) {
      ioredisOptions.tls = { servername: host };
    }

    const redisClient = new IORedis(normalizedForUrl, ioredisOptions);

    redisClient.on("error", (err: any) => {
      logger.error({ err }, "ioredis client error");
    });

    return { connection: redisClient, info: { host, port, hasPassword: !!password, protocol } };
  } catch (error) {
    logger.error({ error, rawUrl }, "Failed to build Redis connection from REDIS_URL, falling back to localhost");
    return { connection: { host: "localhost", port: 6379 }, info: { host: "localhost", port: 6379 } };
  }
};

export const { connection: redisConnection, info: redisInfo } = buildRedisConnection();

export type JobProcessingMode = "bullmq" | "inline";

let jobProcessingMode: JobProcessingMode = "bullmq";

export function getJobProcessingMode(): JobProcessingMode {
  return jobProcessingMode;
}

/**
 * Inline queue — processes jobs immediately (no Redis required).
 * Supports delayed jobs via setTimeout for reminders etc.
 */
export class InlineQueue {
  name: string;
  private completed = 0;
  private failed = 0;
  private active = 0;

  constructor(name: string) {
    this.name = name;
  }

  async add(_jobName: string, data: any, opts?: { delay?: number }) {
    const jobId = `inline-${this.name}-${Date.now()}`;

    const run = async () => {
      this.active += 1;
      try {
        const payload = data as any;
        if (payload?.debtorId) {
          await logJobStarted(payload.debtorId, payload?.matterId ?? null, this.name, jobId, this.name, { data: payload });
        }

        const { processInlineJob } = await import("./jobs/inline");
        await processInlineJob(this.name, data, jobId);
        this.completed += 1;
        return { id: jobId };
      } catch (error) {
        this.failed += 1;
        throw error;
      } finally {
        this.active = Math.max(0, this.active - 1);
      }
    };

    if (opts?.delay && opts.delay > 0) {
      logger.info({ queue: this.name, delayMs: opts.delay, jobId }, "[INLINE] Job scheduled with delay");
      setTimeout(() => {
        run().catch((err) => logger.error({ err, queue: this.name, jobId }, "[INLINE] Delayed job failed"));
      }, opts.delay);
      return { id: jobId };
    }

    return run();
  }

  async close() {
    return;
  }

  async count() {
    return this.active;
  }

  async getJobCounts() {
    return {
      waiting: 0,
      active: this.active,
      completed: this.completed,
      failed: this.failed,
      delayed: 0,
      paused: 0,
    };
  }

  async getCountsAsync() {
    return this.getJobCounts();
  }

  async getWaiting() {
    return [];
  }

  async getActive() {
    return [];
  }

  async getCompleted() {
    return [];
  }

  async getFailed() {
    return [];
  }
}

function createBullMQQueue(name: string) {
  return new Queue(name, { connection: redisConnection });
}

// Queue instances — swapped to InlineQueue when inline mode is enabled
export let interestQueue: Queue | InlineQueue = createBullMQQueue("interest");
export let whatsappQueue: Queue | InlineQueue = createBullMQQueue("whatsapp");
export let documentQueue: Queue | InlineQueue = createBullMQQueue("document");
export let reminderQueue: Queue | InlineQueue = createBullMQQueue("reminder");
export let reportQueue: Queue | InlineQueue = createBullMQQueue("report");
export let autoAdvanceQueue: Queue | InlineQueue = createBullMQQueue("auto-advance");
export let paymentQueue: Queue | InlineQueue = createBullMQQueue("payment");
export let aiQueue: Queue | InlineQueue = createBullMQQueue("ai");

export let allQueues: Array<Queue | InlineQueue> = [
  interestQueue,
  whatsappQueue,
  documentQueue,
  reminderQueue,
  reportQueue,
  autoAdvanceQueue,
  paymentQueue,
  aiQueue,
];

export function enableInlineJobMode(reason: string) {
  if (jobProcessingMode === "inline") return;

  jobProcessingMode = "inline";
  logger.warn({ reason }, "Switching to inline job processing (jobs run immediately, no BullMQ workers)");

  interestQueue = new InlineQueue("interest");
  whatsappQueue = new InlineQueue("whatsapp");
  documentQueue = new InlineQueue("document");
  reminderQueue = new InlineQueue("reminder");
  reportQueue = new InlineQueue("report");
  autoAdvanceQueue = new InlineQueue("auto-advance");
  paymentQueue = new InlineQueue("payment");
  aiQueue = new InlineQueue("ai");

  allQueues = [
    interestQueue,
    whatsappQueue,
    documentQueue,
    reminderQueue,
    reportQueue,
    autoAdvanceQueue,
    paymentQueue,
    aiQueue,
  ];
}

logger.info({
  host: redisInfo.host,
  port: redisInfo.port,
  password: redisInfo.hasPassword ? "***" : "none",
  protocol: redisInfo.protocol,
}, "Queue connection config:");

const queueEventMap: Record<string, QueueEvents> = {};

export function setupQueueEventListeners() {
  if (jobProcessingMode === "inline") return;

  allQueues.forEach((queue) => {
    const events = new QueueEvents(queue.name, { connection: redisConnection });
    queueEventMap[queue.name] = events;

    events.on("completed", (job: any) => {
      logger.info({ jobId: job.jobId }, `[${queue.name}] Job completed`);
    });

    events.on("failed", (job: any, error: any) => {
      logger.error({ jobId: job.jobId, error: error.message }, `[${queue.name}] Job failed`);
    });

    events.on("error", (error: any) => {
      logger.error({ err: error }, `[${queue.name}] Queue error`);
    });
  });

  logger.info("Queue event listeners set up");
}

export async function testRedisConnection(): Promise<boolean> {
  try {
    const result = await redisConnection.ping();
    return result === "PONG";
  } catch (error) {
    logger.warn({ err: error }, "Redis ping failed");
    return false;
  }
}

export async function initializeQueueMode(): Promise<JobProcessingMode> {
  if (process.env.SKIP_WORKERS === "true") {
    enableInlineJobMode("SKIP_WORKERS=true");
    return "inline";
  }

  const redisOk = await testRedisConnection();
  if (!redisOk) {
    enableInlineJobMode("Redis unavailable — falling back to inline processing");
    return "inline";
  }

  jobProcessingMode = "bullmq";
  logger.info("Using BullMQ job queues with Redis");
  return "bullmq";
}

export async function cleanupQueues() {
  logger.info("Cleaning up queues...");
  for (const queue of allQueues) {
    await queue.close();
  }
  for (const events of Object.values(queueEventMap)) {
    await events.close();
  }
  logger.info("Queues closed");
}

export type QueueCounts = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
};

/** Normalized job counts for BullMQ or inline queues */
export async function getQueueCounts(queue: Queue | InlineQueue): Promise<QueueCounts> {
  const counts = await queue.getJobCounts();
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
    paused: counts.paused ?? 0,
  };
}

export async function getQueueHealth() {
  const health: Record<string, any> = {};
  for (const queue of allQueues) {
    try {
      const counts = await (queue as any).getCountsAsync?.() ?? await (queue as any).getJobCounts?.();
      health[queue.name] = {
        mode: jobProcessingMode,
        waiting: counts?.waiting || 0,
        active: counts?.active || 0,
        completed: counts?.completed || 0,
        failed: counts?.failed || 0,
        paused: counts?.paused || 0,
      };
    } catch (error) {
      health[queue.name] = { error: String(error) };
    }
  }
  return health;
}

export async function getQueueNext(limit = 1, queueName?: string) {
  const result: Record<string, { waiting: Array<{ id: string; name: string; data: unknown }>; active: Array<{ id: string; name: string; data: unknown }> }> = {};
  const queues = queueName ? allQueues.filter((q) => q.name === queueName) : allQueues;

  for (const queue of queues) {
    const waitingJobs = [] as any[];
    const activeJobs = [] as any[];
    try {
      const waiting = await (queue as any).getWaiting?.(0, limit) ?? [];
      waitingJobs.push(...waiting.map((job: any) => ({ id: String(job.id), name: job.name, data: job.data })));
    } catch {
      // ignore unsupported
    }
    try {
      const active = await (queue as any).getActive?.(0, limit) ?? [];
      activeJobs.push(...active.map((job: any) => ({ id: String(job.id), name: job.name, data: job.data })));
    } catch {
      // ignore unsupported
    }

    result[queue.name] = {
      waiting: waitingJobs,
      active: activeJobs,
    };
  }

  return result;
}

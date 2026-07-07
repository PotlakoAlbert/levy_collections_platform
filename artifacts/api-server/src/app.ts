import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { setupSwagger } from "./lib/swagger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// App-level request logging for debugging (helps identify early 401s)
app.use((req, _res, next) => {
  // eslint-disable-next-line no-console
  console.log("[APP] Incoming request:", req.method, req.originalUrl);
  // eslint-disable-next-line no-console
  console.log("[APP] Headers:", req.headers);
  next();
});

// Expose a lightweight GET verification endpoint at the app level so
// Meta's webhook verification bypasses any router-level auth middleware.
app.get("/api/whatsapp/webhook", (req, res) => {
  // eslint-disable-next-line no-console
  console.log("[APP] Webhook verification attempt:", req.originalUrl, req.query);

  const VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  const mode = (req.query["hub.mode"] || req.query.hub_mode) as string | undefined;
  const token = (req.query["hub.verify_token"] || req.query.hub_verify_token) as string | undefined;
  const challenge = (req.query["hub.challenge"] || req.query.hub_challenge) as string | undefined;

  // Simple verification logic used by Meta
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    // eslint-disable-next-line no-console
    console.log("[APP] Webhook verified (app-level)");
    return res.status(200).send(challenge ?? "");
  }

  // eslint-disable-next-line no-console
  console.warn("[APP] Webhook verification failed (app-level)", { mode, token, expected: VERIFY_TOKEN });
  return res.sendStatus(403);
});

setupSwagger(app);

app.use("/api", router);

export default app;

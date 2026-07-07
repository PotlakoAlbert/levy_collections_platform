import { readFileSync } from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";

type OpenApiSpec = Record<string, unknown>;
type OpenApiPathItem = Record<string, Record<string, unknown>>;

const PUBLIC_PATHS = new Set([
  "/healthz",
  "/auth/login",
  "/contact",
  "/whatsapp/webhook",
  "/automation-status",
  "/test-job",
  "/test-whatsapp-job",
  "/queue-health",
  "/test-ai",
  "/test-ai-classify",
  "/test-ai-draft",
  "/test-ai-advance",
  "/test-ai-payment",
  "/ai-info",
  "/test-whatsapp-send",
  "/test-whatsapp-webhook",
  "/whatsapp-info",
]);

const PUBLIC_PATH_PREFIXES = ["/test-automations/", "/test-interest-job/"];

function getSpecPath(): string {
  return path.resolve(__dirname, "../../../lib/api-spec/openapi.bundle.json");
}

function applySecurity(spec: OpenApiSpec): void {
  const paths = spec.paths as OpenApiPathItem;
  if (!paths) return;

  for (const [pathKey, methods] of Object.entries(paths)) {
    const isPublic =
      PUBLIC_PATHS.has(pathKey) ||
      PUBLIC_PATH_PREFIXES.some((prefix) => pathKey.startsWith(prefix));

    if (isPublic) continue;

    for (const method of Object.values(methods)) {
      if (typeof method === "object" && method !== null && !Array.isArray(method)) {
        method.security = [{ bearerAuth: [] }];
      }
    }
  }
}

function patchServers(spec: OpenApiSpec): void {
  const port = process.env.PORT ?? "8080";
  spec.servers = [
    {
      url: `http://localhost:${port}/api`,
      description: "Local development server",
    },
    { url: "/api", description: "Relative (same host)" },
  ];
}

let cachedSpec: OpenApiSpec | null = null;

export function loadOpenApiSpec(): OpenApiSpec {
  if (cachedSpec) return cachedSpec;

  const raw = readFileSync(getSpecPath(), "utf8");
  const spec = JSON.parse(raw) as OpenApiSpec;
  patchServers(spec);
  applySecurity(spec);
  cachedSpec = spec;
  return spec;
}

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Levy Collection API — Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js" crossorigin></script>
  <script>
    window.onload = function () {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: "StandaloneLayout",
        persistAuthorization: true,
        tryItOutEnabled: true,
        displayRequestDuration: true,
        filter: true,
        syntaxHighlight: { activate: true, theme: "monokai" },
      });
    };
  </script>
</body>
</html>`;

export function setupSwagger(app: Express): void {
  app.get("/api/openapi.json", (_req: Request, res: Response) => {
    res.json(loadOpenApiSpec());
  });

  app.get("/api/docs", (_req: Request, res: Response) => {
    res.type("html").send(SWAGGER_HTML);
  });

  app.get("/api/docs/", (_req: Request, res: Response) => {
    res.redirect("/api/docs");
  });
}

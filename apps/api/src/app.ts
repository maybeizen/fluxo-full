import type { FluxoLogger } from "@fluxo/logger";
import type { Redis } from "@fluxo/redis";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./middleware/error.js";
import { requestLogger } from "./middleware/logger.js";
import { healthRoutes } from "./routes/health.js";

export interface CreateAppOptions {
  logger: FluxoLogger;
  redis: Pick<Redis, "ping">;
  corsOrigin?: string;
}

export function createApp(options: CreateAppOptions): Hono {
  const app = new Hono();
  app.use("*", cors({ origin: options.corsOrigin ?? "*" }));
  app.onError(errorHandler(options.logger));
  app.use(requestLogger(options.logger));
  app.route("/", healthRoutes(options));
  return app;
}

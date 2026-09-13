import type { FluxoLogger } from "@fluxo/logger";
import type { Redis } from "@fluxo/redis";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppBindings } from "./app-bindings.js";
import type { AuthServices } from "./auth/create-auth.js";
import { errorHandler } from "./middleware/error.js";
import { requestLogger } from "./middleware/logger.js";
import { adminRoutes } from "./routes/admin.js";
import { authRoutes } from "./routes/auth.js";
import { fileRoutes } from "./routes/files.js";
import { healthRoutes } from "./routes/health.js";
import { settingsPublicRoutes } from "./routes/settings.js";

export type { AppBindings };

export interface CreateAppOptions {
  logger: FluxoLogger;
  redis: Pick<Redis, "ping">;
  postgres: { ping: () => Promise<void> };
  corsOrigin?: string;
  auth: AuthServices;
}

export function createApp(options: CreateAppOptions): Hono<AppBindings> {
  const app = new Hono<AppBindings>();
  app.use(
    "*",
    cors({
      origin: options.corsOrigin ?? "*",
      credentials: Boolean(options.corsOrigin),
      allowHeaders: ["Content-Type"],
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.onError(errorHandler(options.logger));
  app.use(requestLogger(options.logger));
  const auth = { ...options.auth, logger: options.logger };
  app.route("/", healthRoutes(options));
  app.route("/settings", settingsPublicRoutes(auth));
  app.route("/auth", authRoutes(auth));
  app.route("/admin", adminRoutes(auth));
  app.route("/files", fileRoutes(options.auth.storage));
  return app;
}

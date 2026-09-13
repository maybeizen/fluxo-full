import type { FluxoLogger } from "@fluxo/logger";
import { createMiddleware } from "hono/factory";

export function requestLogger(logger: FluxoLogger) {
  return createMiddleware(async (c, next) => {
    const started = performance.now();
    await next();
    logger.info("request", {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs: Math.round(performance.now() - started),
    });
  });
}

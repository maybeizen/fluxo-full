import type { FluxoLogger } from "@fluxo/logger";
import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";

export function errorHandler(logger: FluxoLogger): ErrorHandler {
  return (error, c) => {
    if (error instanceof HTTPException) {
      return error.getResponse();
    }

    logger.error(error.message, {
      method: c.req.method,
      path: c.req.path,
    });
    return c.json({ error: "Internal Server Error" }, 500);
  };
}

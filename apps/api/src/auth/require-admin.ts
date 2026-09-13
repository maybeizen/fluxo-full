import { UserRole } from "@fluxo/types";
import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../app-bindings.js";

export function requireAdmin() {
  return createMiddleware<AppBindings>(async (c, next) => {
    if (c.get("user").role !== UserRole.Admin) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });
}

import type { Hono } from "hono";
import type { AppBindings } from "../../app-bindings.js";
import type { AuthRouteOptions } from "./shared.js";

export function registerSessionRoutes(routes: Hono<AppBindings>, options: AuthRouteOptions): void {
  routes.get("/sessions", async (c) => {
    const account = c.get("account");
    const session = c.get("session");
    const records = await options.sessions.listForUser(account.id);
    return c.json({
      sessions: records.map((record) => ({
        id: record.id,
        current: record.id === session.id,
        createdAt: record.createdAt.toISOString(),
        lastSeenAt: record.lastSeenAt.toISOString(),
        userAgent: record.userAgent,
        ip: record.ip,
      })),
    });
  });

  routes.delete("/sessions", async (c) => {
    const account = c.get("account");
    const session = c.get("session");
    await options.sessions.destroyOthersForUser(account.id, session.id);
    return c.json({ ok: true });
  });

  routes.delete("/sessions/:id", async (c) => {
    const account = c.get("account");
    const session = c.get("session");
    const id = c.req.param("id");
    const records = await options.sessions.listForUser(account.id);
    const target = records.find((record) => record.id === id);
    if (!target) {
      return c.json({ error: "Not found" }, 404);
    }

    await options.sessions.destroyById(id);
    if (id === session.id) {
      options.sessions.clearCookie(c);
    }
    return c.json({ ok: true });
  });
}

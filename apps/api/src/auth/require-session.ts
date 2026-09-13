import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppBindings } from "../app-bindings.js";
import { SESSION_COOKIE_NAME } from "./cookie.js";
import type { SessionEngine } from "./session.js";
import type { PasskeyStore, UserStore } from "./stores/types.js";
import { toPublicUser } from "./to-public-user.js";

export function requireSession(options: {
  sessions: SessionEngine;
  users: UserStore;
  passkeys?: PasskeyStore;
}) {
  return createMiddleware<AppBindings>(async (c, next) => {
    const session = await options.sessions.resolve(getCookie(c, SESSION_COOKIE_NAME));
    if (!session) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const user = await options.users.findById(session.userId);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (user.mfaEnabled && !session.mfaVerified) {
      return c.json({ code: "mfa_required" }, 401);
    }

    await options.sessions.touch(session);
    const hasPasskey = options.passkeys ? await options.passkeys.hasForUser(user.id) : false;
    c.set("session", session);
    c.set("account", user);
    c.set("user", toPublicUser(user, hasPasskey));
    await next();
  });
}

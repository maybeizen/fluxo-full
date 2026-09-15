import type { AdminUserDetail, AdminUserListItem } from "@fluxo/types";
import { UserRole } from "@fluxo/types";
import { Hono } from "hono";
import type { AppBindings } from "../app-bindings.js";
import { hashPassword } from "../auth/passwords.js";
import { requireAdmin } from "../auth/require-admin.js";
import { requireSession } from "../auth/require-session.js";
import {
  adminCreateUserBodySchema,
  adminPatchUserBodySchema,
} from "../auth/schemas.js";
import type { UpdateUserInput, UserRecord } from "../auth/stores/types.js";
import { emitForgeEvent } from "../forge/events.js";
import type { AuthRouteOptions } from "./account/shared.js";
import { registerSettingsAdminRoutes } from "./settings.js";

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function toIsoSeconds(date: Date): string {
  return `${date.toISOString().slice(0, 19)}Z`;
}

function toListItem(user: UserRecord, hasPasskey: boolean): AdminUserListItem {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatarUrl: user.avatarUrl,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    mfaEnabled: user.mfaEnabled,
    hasPasskey,
    createdAt: user.createdAt.toISOString(),
    suspended: user.suspendedAt !== null,
  };
}

export function userDeletionBlock(
  actorId: string,
  target: UserRecord,
  adminCount: number,
): "cannot_delete_self" | "cannot_delete_last_admin" | null {
  if (actorId === target.id) {
    return "cannot_delete_self";
  }
  if (target.role === UserRole.Admin && adminCount <= 1) {
    return "cannot_delete_last_admin";
  }
  return null;
}

export function userPatchBlock(
  actorId: string,
  target: UserRecord,
  input: { role?: UserRole; suspended?: boolean },
  adminCount: number,
):
  | "cannot_demote_self"
  | "cannot_suspend_self"
  | "cannot_demote_last_admin"
  | null {
  const demoting =
    input.role === UserRole.User && target.role === UserRole.Admin;
  if (demoting && actorId === target.id) {
    return "cannot_demote_self";
  }
  if (demoting && adminCount <= 1) {
    return "cannot_demote_last_admin";
  }
  if (input.suspended === true && actorId === target.id) {
    return "cannot_suspend_self";
  }
  return null;
}

export function adminRoutes(options: AuthRouteOptions) {
  const routes = new Hono<AppBindings>();
  routes.use(
    "*",
    requireSession({
      sessions: options.sessions,
      users: options.users,
      passkeys: options.passkeys,
    }),
    requireAdmin(),
  );

  registerSettingsAdminRoutes(routes, options);

  routes.get("/users", async (c) => {
    const users = await options.users.list();
    const passkeyFlags = await Promise.all(
      users.map((user) => options.passkeys.hasForUser(user.id)),
    );
    return c.json({
      users: users.map((user, index) =>
        toListItem(user, passkeyFlags[index] === true),
      ),
    });
  });

  routes.get("/users/:id", async (c) => {
    const user = await options.users.findById(c.req.param("id"));
    if (!user) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.json(await toAdminDetail(options, user));
  });

  routes.post("/users", async (c) => {
    const parsed = adminCreateUserBodySchema.safeParse(
      await readJson(c.req.raw),
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const body = parsed.data;
    const existing =
      (await options.users.findByUsername(body.username)) ??
      (await options.users.findByEmail(body.email));
    if (existing) {
      return c.json({ error: "Username or email already in use" }, 409);
    }

    const passwordHash = await hashPassword(
      body.password,
      options.config.bcryptRounds,
    );
    const user = await options.users.create({
      username: body.username,
      email: body.email,
      passwordHash,
      firstName: body.firstName,
      lastName: body.lastName,
      role: body.role ?? UserRole.User,
      emailVerifiedAt: (body.emailVerified ?? true) ? new Date() : null,
    });
    await emitForgeEvent("user.created", { userId: user.id });

    return c.json(await toAdminDetail(options, user), 201);
  });

  routes.patch("/users/:id", async (c) => {
    const parsed = adminPatchUserBodySchema.safeParse(
      await readJson(c.req.raw),
    );
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const user = await options.users.findById(c.req.param("id"));
    if (!user) {
      return c.json({ error: "Not found" }, 404);
    }

    const body = parsed.data;
    if (body.username && body.username !== user.username) {
      const taken = await options.users.findByUsername(body.username);
      if (taken && taken.id !== user.id) {
        return c.json({ error: "Username or email already in use" }, 409);
      }
    }
    if (body.email && body.email !== user.email) {
      const taken = await options.users.findByEmail(body.email);
      if (taken && taken.id !== user.id) {
        return c.json({ error: "Username or email already in use" }, 409);
      }
    }

    const block = userPatchBlock(
      c.get("user").id,
      user,
      body,
      await options.users.countByRole(UserRole.Admin),
    );
    if (block) {
      return c.json({ code: block }, 403);
    }

    const patch: UpdateUserInput = {};
    if (body.firstName !== undefined) {
      patch.firstName = body.firstName;
    }
    if (body.lastName !== undefined) {
      patch.lastName = body.lastName;
    }
    if (body.username !== undefined) {
      patch.username = body.username;
    }
    if (body.email !== undefined) {
      patch.email = body.email;
    }
    if (body.dateOfBirth !== undefined) {
      patch.dateOfBirth = body.dateOfBirth;
    }
    if (body.company !== undefined) {
      patch.company = body.company;
    }
    if (body.role !== undefined) {
      patch.role = body.role;
    }
    if (body.emailVerified !== undefined) {
      patch.emailVerifiedAt = body.emailVerified
        ? (user.emailVerifiedAt ?? new Date())
        : null;
    }
    if (body.password !== undefined) {
      patch.passwordHash = await hashPassword(
        body.password,
        options.config.bcryptRounds,
      );
    }
    if (body.suspended === true) {
      patch.suspendedAt = user.suspendedAt ?? new Date();
      patch.suspendedReason = body.suspendedReason ?? user.suspendedReason;
    } else if (body.suspended === false) {
      patch.suspendedAt = null;
      patch.suspendedReason = null;
    } else if (
      body.suspendedReason !== undefined &&
      user.suspendedAt !== null
    ) {
      patch.suspendedReason = body.suspendedReason;
    }

    const updated = (await options.users.update(user.id, patch)) ?? user;
    if (body.password !== undefined && updated.id !== c.get("user").id) {
      await options.sessions.destroyAllForUser(updated.id);
    }
    await emitForgeEvent("user.updated", { userId: updated.id });
    if (body.role !== undefined && body.role !== user.role) {
      await emitForgeEvent("user.roleChanged", {
        userId: updated.id,
        role: updated.role,
      });
    }
    const wasSuspended = user.suspendedAt !== null;
    const isSuspended = updated.suspendedAt !== null;
    if (!wasSuspended && isSuspended) {
      await emitForgeEvent("user.suspended", {
        userId: updated.id,
        reason: updated.suspendedReason,
      });
    } else if (wasSuspended && !isSuspended) {
      await emitForgeEvent("user.unsuspended", { userId: updated.id });
    }
    return c.json(await toAdminDetail(options, updated));
  });

  routes.delete("/users/:id", async (c) => {
    const user = await options.users.findById(c.req.param("id"));
    if (!user) {
      return c.json({ error: "Not found" }, 404);
    }

    const block = userDeletionBlock(
      c.get("user").id,
      user,
      await options.users.countByRole(UserRole.Admin),
    );
    if (block) {
      return c.json({ code: block }, 403);
    }

    await options.sessions.destroyAllForUser(user.id);
    await options.users.delete(user.id);
    await emitForgeEvent("user.deleted", { userId: user.id });
    return c.json({ ok: true });
  });

  return routes;
}

async function toAdminDetail(
  options: AuthRouteOptions,
  user: UserRecord,
): Promise<AdminUserDetail> {
  const [passkeys, sessions] = await Promise.all([
    options.passkeys.listByUserId(user.id),
    options.sessions.listForUser(user.id),
  ]);
  const lastSeen = sessions.reduce<Date | null>((latest, session) => {
    if (!latest || session.lastSeenAt.getTime() > latest.getTime()) {
      return session.lastSeenAt;
    }
    return latest;
  }, null);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl,
    avatarSource: user.avatarSource,
    dateOfBirth: user.dateOfBirth,
    company: user.company,
    role: user.role,
    emailVerified: user.emailVerifiedAt !== null,
    mfaEnabled: user.mfaEnabled,
    hasPasskey: passkeys.length > 0,
    passkeys: passkeys.map((passkey) => ({ name: passkey.name })),
    createdAt: toIsoSeconds(user.createdAt),
    lastActiveAt: lastSeen ? toIsoSeconds(lastSeen) : null,
    suspended: user.suspendedAt !== null,
    suspendedAt: user.suspendedAt ? toIsoSeconds(user.suspendedAt) : null,
    suspendedReason: user.suspendedReason,
  };
}

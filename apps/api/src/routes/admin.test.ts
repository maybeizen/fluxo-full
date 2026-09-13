import type { FluxoLogger } from "@fluxo/logger";
import {
  UserRole,
  type AdminUserDetail,
  type AdminUserListResponse,
  type PublicUser,
} from "@fluxo/types";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { createMemoryAuth } from "../auth/stores/memory.js";
import { userDeletionBlock, userPatchBlock } from "./admin.js";

function mockLogger(): FluxoLogger {
  const logger: FluxoLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

function setup() {
  const auth = createMemoryAuth();
  const app = createApp({
    logger: mockLogger(),
    redis: { ping: async () => "PONG" },
    postgres: { ping: async () => undefined },
    corsOrigin: "http://localhost:5173",
    auth,
  });
  return { app, ...auth };
}

function sessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((value) => value.startsWith("fluxo.sid="));
  if (!session) {
    throw new Error("missing fluxo.sid cookie");
  }
  return session.split(";", 1)[0] ?? session;
}

async function register(
  app: ReturnType<typeof createApp>,
  overrides?: Partial<{
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }>,
) {
  return app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "ada",
      email: "ada@example.com",
      password: "password12",
      firstName: "Ada",
      lastName: "Lovelace",
      ...overrides,
    }),
  });
}

async function login(
  app: ReturnType<typeof createApp>,
  overrides?: Partial<{ username: string; password: string }>,
) {
  return app.request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "ada",
      password: "password12",
      rememberMe: true,
      ...overrides,
    }),
  });
}

async function signedInAdmin() {
  const ctx = setup();
  await register(ctx.app);
  const loggedIn = await login(ctx.app);
  return { ...ctx, cookie: sessionCookie(loggedIn) };
}

describe("userDeletionBlock", () => {
  const admin = {
    id: "admin-1",
    role: UserRole.Admin,
  } as const;

  it("rejects self-delete before last-admin", () => {
    expect(
      userDeletionBlock("admin-1", { ...admin, id: "admin-1" } as never, 1),
    ).toBe("cannot_delete_self");
  });

  it("rejects deleting the last remaining admin", () => {
    expect(
      userDeletionBlock("admin-2", { ...admin, id: "admin-1" } as never, 1),
    ).toBe("cannot_delete_last_admin");
  });
});

describe("userPatchBlock", () => {
  const admin = {
    id: "admin-1",
    role: UserRole.Admin,
  } as const;

  it("rejects self-demotion before last-admin", () => {
    expect(
      userPatchBlock("admin-1", { ...admin } as never, { role: UserRole.User }, 2),
    ).toBe("cannot_demote_self");
  });

  it("rejects demoting the last remaining admin", () => {
    expect(
      userPatchBlock("admin-2", { ...admin } as never, { role: UserRole.User }, 1),
    ).toBe("cannot_demote_last_admin");
  });

  it("rejects self-suspension", () => {
    expect(
      userPatchBlock("admin-1", { ...admin } as never, { suspended: true }, 2),
    ).toBe("cannot_suspend_self");
  });
});

describe("admin users api", () => {
  it("requires an admin session", async () => {
    const { app } = setup();
    const anonymous = await app.request("/admin/users");
    expect(anonymous.status).toBe(401);

    await register(app);
    await register(app, { username: "bob", email: "bob@example.com" });
    const memberLogin = await login(app, { username: "bob" });
    const member = await app.request("/admin/users", {
      headers: { cookie: sessionCookie(memberLogin) },
    });
    expect(member.status).toBe(403);
    expect(await member.json()).toEqual({ error: "Forbidden" });
  });

  it("lists users and returns admin detail", async () => {
    const { app, cookie } = await signedInAdmin();
    await register(app, { username: "bob", email: "bob@example.com" });

    const list = await app.request("/admin/users", { headers: { cookie } });
    expect(list.status).toBe(200);
    const listed = (await list.json()) as AdminUserListResponse;
    expect(listed.users).toHaveLength(2);
    expect(listed.users.map((user) => user.username).sort()).toEqual(["ada", "bob"]);
    expect(listed.users.find((user) => user.username === "ada")?.role).toBe(UserRole.Admin);

    const ada = listed.users.find((user) => user.username === "ada");
    if (!ada) {
      throw new Error("expected ada");
    }
    const detail = await app.request(`/admin/users/${ada.id}`, { headers: { cookie } });
    expect(detail.status).toBe(200);
    const body = (await detail.json()) as AdminUserDetail;
    expect(body.username).toBe("ada");
    expect(body.firstName).toBe("Ada");
    expect(body.lastActiveAt).toEqual(expect.any(String));
    expect(body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(body.suspended).toBe(false);
    expect(body.mfaEnabled).toBe(false);
    expect(body.hasPasskey).toBe(false);
    expect(body.passkeys).toEqual([]);
    expect(listed.users[0]).toEqual(
      expect.objectContaining({
        mfaEnabled: expect.any(Boolean),
        hasPasskey: false,
      }),
    );
  });

  it("creates a user", async () => {
    const { app, cookie } = await signedInAdmin();
    const created = await app.request("/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        username: "grace",
        email: "grace@example.com",
        firstName: "Grace",
        lastName: "Hopper",
        password: "password12",
        role: UserRole.User,
        emailVerified: true,
      }),
    });
    expect(created.status).toBe(201);
    const body = (await created.json()) as AdminUserDetail;
    expect(body.username).toBe("grace");
    expect(body.role).toBe(UserRole.User);
    expect(body.emailVerified).toBe(true);

    const duplicate = await app.request("/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        username: "grace",
        email: "grace2@example.com",
        firstName: "Grace",
        lastName: "Hopper",
        password: "password12",
      }),
    });
    expect(duplicate.status).toBe(409);
  });

  it("patches profile, security, and suspension fields", async () => {
    const { app, cookie, users } = await signedInAdmin();
    await register(app, { username: "bob", email: "bob@example.com" });
    const bob = await users.findByUsername("bob");
    if (!bob) {
      throw new Error("expected bob");
    }

    const missingReason = await app.request(`/admin/users/${bob.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ suspended: true }),
    });
    expect(missingReason.status).toBe(400);

    const suspended = await app.request(`/admin/users/${bob.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        firstName: "Robert",
        username: "robert",
        email: "robert@example.com",
        company: "Fluxo",
        role: UserRole.Admin,
        emailVerified: false,
        password: "password99",
        suspended: true,
        suspendedReason: "Terms violation",
      }),
    });
    expect(suspended.status).toBe(200);
    const body = (await suspended.json()) as AdminUserDetail;
    expect(body.firstName).toBe("Robert");
    expect(body.username).toBe("robert");
    expect(body.email).toBe("robert@example.com");
    expect(body.company).toBe("Fluxo");
    expect(body.role).toBe(UserRole.Admin);
    expect(body.emailVerified).toBe(false);
    expect(body.suspended).toBe(true);
    expect(body.suspendedReason).toBe("Terms violation");
    expect(body.suspendedAt).toEqual(expect.any(String));

    const cleared = await app.request(`/admin/users/${bob.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ suspended: false }),
    });
    const clearedBody = (await cleared.json()) as AdminUserDetail;
    expect(clearedBody.suspended).toBe(false);
    expect(clearedBody.suspendedAt).toBeNull();
    expect(clearedBody.suspendedReason).toBeNull();
  });

  it("exposes suspension on /auth/me", async () => {
    const { app, cookie, users } = await signedInAdmin();
    await register(app, { username: "bob", email: "bob@example.com" });
    const bob = await users.findByUsername("bob");
    if (!bob) {
      throw new Error("expected bob");
    }

    await app.request(`/admin/users/${bob.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ suspended: true, suspendedReason: "Review" }),
    });

    const memberLogin = await login(app, { username: "bob" });
    const me = await app.request("/auth/me", {
      headers: { cookie: sessionCookie(memberLogin) },
    });
    expect(me.status).toBe(200);
    const body = (await me.json()) as { user: PublicUser };
    expect(body.user.suspended).toBe(true);
    expect(body.user.suspendedReason).toBe("Review");
  });

  it("rejects self-delete, self-demotion, and self-suspension", async () => {
    const { app, cookie, users } = await signedInAdmin();
    const ada = await users.findByUsername("ada");
    if (!ada) {
      throw new Error("expected ada");
    }

    const selfDelete = await app.request(`/admin/users/${ada.id}`, {
      method: "DELETE",
      headers: { cookie },
    });
    expect(selfDelete.status).toBe(403);
    expect(await selfDelete.json()).toEqual({ code: "cannot_delete_self" });

    const demote = await app.request(`/admin/users/${ada.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ role: UserRole.User }),
    });
    expect(demote.status).toBe(403);
    expect(await demote.json()).toEqual({ code: "cannot_demote_self" });

    const selfSuspend = await app.request(`/admin/users/${ada.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ suspended: true, suspendedReason: "Review" }),
    });
    expect(selfSuspend.status).toBe(403);
    expect(await selfSuspend.json()).toEqual({ code: "cannot_suspend_self" });
  });

  it("rejects self-demotion when another admin exists", async () => {
    const { app, cookie, users } = await signedInAdmin();
    await register(app, { username: "bob", email: "bob@example.com" });
    const bob = await users.findByUsername("bob");
    const ada = await users.findByUsername("ada");
    if (!bob || !ada) {
      throw new Error("expected ada and bob");
    }

    const promoted = await app.request(`/admin/users/${bob.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ role: UserRole.Admin }),
    });
    expect(promoted.status).toBe(200);

    const demote = await app.request(`/admin/users/${ada.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ role: UserRole.User }),
    });
    expect(demote.status).toBe(403);
    expect(await demote.json()).toEqual({ code: "cannot_demote_self" });
  });

  it("deletes another user but not the last admin", async () => {
    const { app, cookie, users } = await signedInAdmin();
    await register(app, { username: "bob", email: "bob@example.com" });
    const bob = await users.findByUsername("bob");
    if (!bob) {
      throw new Error("expected bob");
    }

    const deleted = await app.request(`/admin/users/${bob.id}`, {
      method: "DELETE",
      headers: { cookie },
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ ok: true });
    expect(await users.findById(bob.id)).toBeNull();

    const missing = await app.request(`/admin/users/${bob.id}`, { headers: { cookie } });
    expect(missing.status).toBe(404);
  });
});

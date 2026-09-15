import type { FluxoLogger } from "@fluxo/logger";
import {
  FORGE_API_VERSION,
  type FluxoPlugin,
  type PluginDefinition,
  type PluginHealthResult,
} from "@fluxo/forge";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createMemoryAuth } from "../auth/stores/memory.js";
import {
  createAdminPluginService,
  type AdminPluginManager,
} from "../forge/admin-plugins.js";
import { createMemoryPluginPersist } from "../forge/persist.js";
import { errorHandler } from "../middleware/error.js";
import { authRoutes } from "./auth.js";
import { adminPluginRoutes } from "./admin-plugins.js";

const SECRET = "tok_live_super_secret";

const mailManifest = {
  id: "acme.mail",
  name: "Mail",
  version: "1.0.0",
  type: "service" as const,
  forgeApi: "^0.1.0",
  entry: "index.js",
  description: "Outbound mail",
  author: "Acme",
  permissions: ["config.read", "config.write"] as const,
  config: [
    { key: "host", type: "text" as const, label: "Host", required: true, minLength: 1 },
    { key: "port", type: "number" as const, label: "Port", integer: true, min: 1, max: 65535, default: 25 },
    { key: "api_token", type: "secret" as const, label: "API token", required: true },
    { key: "secure", type: "boolean" as const, label: "Secure", default: false },
  ],
};

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

function sessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((value) => value.startsWith("fluxo.sid="));
  if (!session) {
    throw new Error("missing fluxo.sid cookie");
  }
  return session.split(";", 1)[0] ?? session;
}

function createFakeManager(options?: {
  definitions?: PluginDefinition[];
  plugin?: FluxoPlugin;
  health?: (signal: AbortSignal) => Promise<PluginHealthResult>;
}): AdminPluginManager & { enabled: string[]; disabled: string[] } {
  const definitions = options?.definitions ?? [];
  const enabled: string[] = [];
  const disabled: string[] = [];
  const plugin: FluxoPlugin | undefined = options?.plugin ??
    (options?.health
      ? {
          manifest: mailManifest,
          health: async (_ctx, signal) => options.health!(signal),
        }
      : undefined);

  return {
    enabled,
    disabled,
    async listDefinitions() {
      return definitions;
    },
    async getDefinition(id) {
      return definitions.find((item) => item.id === id) ?? null;
    },
    async enable(id) {
      enabled.push(id);
    },
    async disable(id) {
      disabled.push(id);
    },
    async uninstall() {},
    getActive(id) {
      return plugin && definitions.some((item) => item.id === id) ? plugin : undefined;
    },
    getPlugin(id) {
      return plugin && definitions.some((item) => item.id === id) ? plugin : undefined;
    },
  };
}

async function setup(options?: { manager?: AdminPluginManager }) {
  const auth = createMemoryAuth();
  const persist = createMemoryPluginPersist();
  const logger = mockLogger();
  const app = new Hono();
  app.onError(errorHandler(logger));
  const authOptions = { ...auth, logger };
  app.route("/auth", authRoutes(authOptions));
  app.route(
    "/admin",
    adminPluginRoutes({
      sessions: auth.sessions,
      users: auth.users,
      passkeys: auth.passkeys,
      persist,
      manager: options?.manager,
    }),
  );
  return { app, persist, ...auth };
}

async function register(
  app: Hono,
  overrides?: Partial<{ username: string; email: string }>,
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

async function login(app: Hono, overrides?: Partial<{ username: string; password: string }>) {
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
  const ctx = await setup();
  await register(ctx.app);
  const loggedIn = await login(ctx.app);
  return { ...ctx, cookie: sessionCookie(loggedIn) };
}

async function seedMail(persist: ReturnType<typeof createMemoryPluginPersist>) {
  await persist.upsertInstall({
    id: "acme.mail",
    type: "service",
    version: "1.0.0",
    manifest: mailManifest,
    enabled: true,
    status: "enabled",
  });
}

describe("admin plugins api", () => {
  it("requires an admin session", async () => {
    const { app } = await setup();
    const anonymous = await app.request("/admin/plugins");
    expect(anonymous.status).toBe(401);
    expect(await anonymous.json()).toEqual({ error: "Unauthorized" });

    await register(app);
    await register(app, { username: "bob", email: "bob@example.com" });
    const memberLogin = await login(app, { username: "bob" });
    const member = await app.request("/admin/plugins", {
      headers: { cookie: sessionCookie(memberLogin) },
    });
    expect(member.status).toBe(403);
    expect(await member.json()).toEqual({ error: "Forbidden" });
  });

  it("lists installed plugins with metadata, permissions, and compatibility", async () => {
    const { app, persist, cookie } = await signedInAdmin();
    await seedMail(persist);

    const response = await app.request("/admin/plugins", {
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      plugins: Array<{
        id: string;
        name: string;
        version: string;
        type: string;
        author?: string;
        description?: string;
        enabled: boolean;
        permissions: string[];
        compatibility: { ok: boolean; hostVersion: string };
      }>;
    };
    expect(body.plugins).toHaveLength(1);
    expect(body.plugins[0]).toMatchObject({
      id: "acme.mail",
      name: "Mail",
      version: "1.0.0",
      type: "service",
      author: "Acme",
      description: "Outbound mail",
      enabled: true,
      permissions: ["config.read", "config.write"],
    });
    expect(body.plugins[0]?.compatibility.ok).toBe(true);
    expect(body.plugins[0]?.compatibility.hostVersion).toBe(FORGE_API_VERSION);
  });

  it("returns 409 when disable is blocked by enabled instances", async () => {
    const { app, persist, cookie } = await signedInAdmin();
    await seedMail(persist);
    await persist.createInstance({
      pluginId: "acme.mail",
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });

    const response = await app.request("/admin/plugins/acme.mail/disable", {
      method: "POST",
      headers: { cookie },
    });
    expect(response.status).toBe(409);
    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe("forge_conflict");
    expect(body.error).toContain("enabled instance");
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("redacts secret values on GET config", async () => {
    const { app, persist, cookie } = await signedInAdmin();
    await seedMail(persist);
    await persist.setKv("acme.mail", "fluxo/admin-config", { host: "smtp.example.com", port: 25 });
    await persist.setSecret("acme.mail", "api_token", SECRET);

    const response = await app.request("/admin/plugins/acme.mail/config", {
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      values: Record<string, unknown>;
      secretKeysSet: string[];
      schema: Array<{ key: string }>;
    };
    expect(body.values).toEqual({ host: "smtp.example.com", port: 25 });
    expect(body.values).not.toHaveProperty("api_token");
    expect(body.secretKeysSet).toEqual(["api_token"]);
    expect(body.schema.map((field) => field.key)).toEqual(["host", "port", "api_token", "secure"]);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("rejects invalid config and does not leak secrets", async () => {
    const { app, persist, cookie } = await signedInAdmin();
    await seedMail(persist);

    const response = await app.request("/admin/plugins/acme.mail/config", {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ host: "smtp.example.com", port: "not-a-number", api_token: SECRET }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string; code: string };
    expect(body.code).toBe("forge_config");
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("keeps an existing secret when PUT config omits it", async () => {
    const { app, persist, cookie } = await signedInAdmin();
    await seedMail(persist);
    await persist.setSecret("acme.mail", "api_token", SECRET);

    const response = await app.request("/admin/plugins/acme.mail/config", {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ host: "smtp.example.com" }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      values: Record<string, unknown>;
      secretKeysSet: string[];
    };
    expect(body.values.host).toBe("smtp.example.com");
    expect(body.secretKeysSet).toEqual(["api_token"]);
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(await persist.getSecret("acme.mail", "api_token")).toBe(SECRET);
  });

  it("creates instances and redacts instance secrets", async () => {
    const { app, persist, cookie } = await signedInAdmin();
    await seedMail(persist);

    const created = await app.request("/admin/plugins/acme.mail/instances", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ displayName: "Primary", enabled: true }),
    });
    expect(created.status).toBe(201);
    const instance = (await created.json()) as { id: string; displayName: string };

    const put = await app.request(
      `/admin/plugins/acme.mail/instances/${instance.id}/config`,
      {
        method: "PUT",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ host: "smtp.example.com", api_token: SECRET }),
      },
    );
    expect(put.status).toBe(200);
    const config = (await put.json()) as {
      values: Record<string, unknown>;
      secretKeysSet: string[];
    };
    expect(config.values).toEqual({ host: "smtp.example.com", port: 25, secure: false });
    expect(config.secretKeysSet).toEqual(["api_token"]);
    expect(JSON.stringify(config)).not.toContain(SECRET);

    const listed = await app.request("/admin/plugins/acme.mail/instances", {
      headers: { cookie },
    });
    const listBody = (await listed.json()) as {
      instances: Array<{ config: { values: Record<string, unknown>; secretKeysSet: string[] } }>;
    };
    expect(JSON.stringify(listBody)).not.toContain(SECRET);
    expect(listBody.instances[0]?.config.secretKeysSet).toEqual(["api_token"]);
  });

  it("uninstalls without purging storage by default", async () => {
    const { app, persist, cookie } = await signedInAdmin();
    await seedMail(persist);
    await persist.setKv("acme.mail", "kept", "yes");
    await persist.setSecret("acme.mail", "api_token", SECRET);

    const response = await app.request("/admin/plugins/acme.mail", {
      method: "DELETE",
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    expect(await persist.getInstall("acme.mail")).toBeUndefined();
    expect(await persist.getKv("acme.mail", "kept")).toBe("yes");
    expect(await persist.getSecret("acme.mail", "api_token")).toBe(SECRET);

    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    const purged = await app.request("/admin/plugins/acme.mail?purgeStorage=true", {
      method: "DELETE",
      headers: { cookie },
    });
    expect(purged.status).toBe(200);
    expect(await persist.getKv("acme.mail", "kept")).toBeUndefined();
    expect(await persist.getSecret("acme.mail", "api_token")).toBeNull();
  });

  it("strips secrets from on-demand health errors", async () => {
    const definition: PluginDefinition = {
      id: "acme.mail",
      type: "service",
      manifest: mailManifest,
      status: "started",
    };
    const manager = createFakeManager({
      definitions: [definition],
      health: async () => ({
        status: "unhealthy",
        message: `token ${SECRET} failed`,
      }),
    });
    const auth = createMemoryAuth();
    const persist = createMemoryPluginPersist();
    await seedMail(persist);
    await persist.setSecret("acme.mail", "api_token", SECRET);
    const logger = mockLogger();
    const app = new Hono();
    app.onError(errorHandler(logger));
    app.route("/auth", authRoutes({ ...auth, logger }));
    app.route(
      "/admin",
      adminPluginRoutes({
        sessions: auth.sessions,
        users: auth.users,
        passkeys: auth.passkeys,
        persist,
        manager,
      }),
    );
    await register(app);
    const loggedIn = await login(app);
    const cookie = sessionCookie(loggedIn);

    const response = await app.request("/admin/plugins/acme.mail/health", {
      method: "POST",
      headers: { cookie },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string; message?: string };
    expect(body.status).toBe("unhealthy");
    expect(body.message).toContain("[redacted]");
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });
});

describe("createAdminPluginService", () => {
  it("lists discovered plugins that are not yet installed", async () => {
    const persist = createMemoryPluginPersist();
    const definition: PluginDefinition = {
      id: "acme.mail",
      type: "service",
      manifest: mailManifest,
      status: "disabled",
    };
    const service = createAdminPluginService({
      persist,
      manager: createFakeManager({ definitions: [definition] }),
    });
    const listed = await service.list();
    expect(listed[0]).toMatchObject({
      id: "acme.mail",
      installed: false,
      discovered: true,
      enabled: false,
    });
  });
});

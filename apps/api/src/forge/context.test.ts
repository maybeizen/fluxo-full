import {
  ForgeError,
  ForgePermissionError,
  type PluginLogger,
  type PluginPermission,
} from "@fluxo/forge";
import { UserRole } from "@fluxo/types";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryUserStore } from "../auth/stores/memory.js";
import { createMemorySettingsRuntime } from "../settings/runtime.js";
import { createPluginContext, intersectPluginPermissions } from "./context.js";
import { createForgeEventBus } from "./events.js";
import { createJobScheduler, type JobScheduler } from "./jobs.js";
import { createMemoryPluginPersist, type PluginPersist } from "./persist.js";

function silentLogger(): PluginLogger {
  const logger: PluginLogger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return logger;
    },
  };
  return logger;
}

const schedulers: JobScheduler[] = [];

afterEach(async () => {
  await Promise.all(
    schedulers.splice(0).map((scheduler) => scheduler.stopAll()),
  );
});

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 800,
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function context(options: {
  pluginId?: string;
  persist?: PluginPersist;
  permissions?: readonly PluginPermission[];
  instanceId?: string;
  users?: ReturnType<typeof createMemoryUserStore>;
  settings?: ReturnType<typeof createMemorySettingsRuntime>;
}) {
  const persist = options.persist ?? createMemoryPluginPersist();
  const logger = silentLogger();
  const jobs = createJobScheduler({ logger, isPluginEnabled: () => true });
  schedulers.push(jobs);
  return createPluginContext({
    pluginId: options.pluginId ?? "acme.demo",
    pluginVersion: "1.0.0",
    instanceId: options.instanceId,
    persist,
    permissions: options.permissions ?? [],
    logger,
    events: createForgeEventBus(),
    jobs,
    users: options.users,
    settings: options.settings,
    httpAllowlist: ["panel.example.com"],
  });
}

describe("plugin context permissions", () => {
  it("denies missing capabilities with ForgePermissionError", async () => {
    const ctx = await context({ permissions: [] });
    await expect(ctx.storage.get("state")).rejects.toBeInstanceOf(
      ForgePermissionError,
    );
    await expect(ctx.storage.set("state", 1)).rejects.toBeInstanceOf(
      ForgePermissionError,
    );
    await expect(
      ctx.http.request({ url: "https://panel.example.com" }),
    ).rejects.toBeInstanceOf(ForgePermissionError);
    expect(() => ctx.events.on("user.created", () => undefined)).toThrow(
      ForgePermissionError,
    );
    await expect(ctx.jobs.schedule({ name: "tick" })).rejects.toBeInstanceOf(
      ForgePermissionError,
    );
    await expect(ctx.users.getById("u1")).rejects.toBeInstanceOf(
      ForgePermissionError,
    );
    await expect(ctx.settings.getPublic()).rejects.toBeInstanceOf(
      ForgePermissionError,
    );
  });

  it("intersects disk and install permissions without expanding", () => {
    expect(
      intersectPluginPermissions(
        ["storage.read"],
        ["storage.read", "storage.write", "http.outbound"],
      ),
    ).toEqual(["storage.read"]);
    expect(
      intersectPluginPermissions(
        ["storage.read", "storage.write", "http.outbound"],
        ["storage.read", "storage.write"],
      ),
    ).toEqual(["storage.read", "storage.write"]);
  });
});

describe("plugin storage namespace", () => {
  it("binds KV to the host plugin id and has no forPlugin switch", async () => {
    const persist = createMemoryPluginPersist();
    const mail = await context({
      pluginId: "acme.mail",
      persist,
      permissions: ["storage.read", "storage.write"],
    });
    const dns = await context({
      pluginId: "acme.dns",
      persist,
      permissions: ["storage.read", "storage.write"],
    });
    await mail.storage.set("state/item", { owner: "mail" });
    expect(await mail.storage.get("state/item")).toEqual({ owner: "mail" });
    expect(await dns.storage.get("state/item")).toBeUndefined();
    await dns.storage.set("state/item", { owner: "dns" });
    expect(await persist.getKv("acme.mail", "state/item")).toEqual({
      owner: "mail",
    });
    expect(await persist.getKv("acme.dns", "state/item")).toEqual({
      owner: "dns",
    });
    expect("forPlugin" in mail.storage).toBe(false);
    expect(mail.pluginId).toBe("acme.mail");
    expect(dns.pluginId).toBe("acme.dns");
  });
});

describe("plugin users and settings", () => {
  it("returns a public user view without hashes or mfa secrets", async () => {
    const users = createMemoryUserStore();
    const user = await users.create({
      username: "ada",
      email: "ada@example.com",
      passwordHash: "hashed-secret-password",
      firstName: "Ada",
      lastName: "Lovelace",
      role: UserRole.User,
      emailVerifiedAt: new Date(),
      mfaEnabled: true,
      mfaSecret: "totp-secret-value",
    });
    const ctx = await context({ permissions: ["users.read"], users });
    const view = await ctx.users.getById(user.id);
    expect(view).toEqual({
      id: user.id,
      username: "ada",
      email: "ada@example.com",
      role: UserRole.User,
      suspended: false,
    });
    expect(JSON.stringify(view)).not.toContain("hashed-secret-password");
    expect(JSON.stringify(view)).not.toContain("totp-secret-value");
  });

  it("returns the public billing subset from settings", async () => {
    const settings = createMemorySettingsRuntime({
      appName: "Acme",
      appBaseUrl: "https://panel.example.com",
      apiUrl: "https://api.example.com",
      appKey: "",
      storageProvider: "local",
      s3ForcePathStyle: true,
    });
    await settings.patch({
      billingCurrency: "EUR",
      billingLocale: "fr-FR",
      billingTimezone: "Europe/Paris",
    });
    const ctx = await context({ permissions: ["settings.read"], settings });
    await expect(ctx.settings.getPublic()).resolves.toEqual({
      appName: "Acme",
      appBaseUrl: "https://panel.example.com",
      billingCurrency: "EUR",
      billingLocale: "fr-FR",
      billingTimezone: "Europe/Paris",
    });
  });
});

const mailManifest = {
  id: "acme.mail",
  name: "Mail",
  version: "1.0.0",
  type: "service" as const,
  forgeApi: "^0.1.0",
  entry: "index.js",
  config: [
    { key: "url", label: "URL", type: "url" as const },
    { key: "sandbox", label: "Sandbox", type: "boolean" as const },
    { key: "region", label: "Region", type: "text" as const },
    { key: "api_token", label: "Token", type: "secret" as const },
  ],
};

describe("plugin admin config", () => {
  it("loads plugin-level admin config without an instance id", async () => {
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    await persist.setKv("acme.mail", "fluxo/admin-config", {
      url: "https://panel.example",
      sandbox: true,
      api_token: "should-not-appear",
    });
    await persist.setSecret("acme.mail", "api_token", "plugin-secret");
    const ctx = await context({ pluginId: "acme.mail", persist });
    expect(ctx.config.get("url")).toBe("https://panel.example");
    expect(ctx.config.get("sandbox")).toBe(true);
    expect(ctx.config.get("api_token")).toBeUndefined();
    expect(ctx.config.getSecret("api_token")).toBe("plugin-secret");
    expect(ctx.config.all()).toEqual({
      url: "https://panel.example",
      sandbox: true,
    });
  });

  it("overlays instance config and instance secrets on plugin-level values", async () => {
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    await persist.setKv("acme.mail", "fluxo/admin-config", {
      url: "https://plugin.example",
      sandbox: true,
      region: "eu",
    });
    const instance = await persist.createInstance({
      pluginId: "acme.mail",
      kind: "service",
      displayName: "Primary",
      config: { url: "https://instance.example", sandbox: false },
    });
    await persist.setSecret("acme.mail", "api_token", "plugin-secret");
    await persist.setSecret(
      "acme.mail",
      "api_token",
      "instance-secret",
      instance.id,
    );
    const ctx = await context({
      pluginId: "acme.mail",
      persist,
      instanceId: instance.id,
    });
    expect(ctx.config.get("url")).toBe("https://instance.example");
    expect(ctx.config.get("sandbox")).toBe(false);
    expect(ctx.config.get("region")).toBe("eu");
    expect(ctx.config.getSecret("api_token")).toBe("instance-secret");
    expect(ctx.config.all()).not.toHaveProperty("api_token");
  });
});

describe("plugin storage reserved keys", () => {
  it("rejects plugin writes to host forge/ and fluxo/ keys", async () => {
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "acme.demo",
      type: "service",
      version: "1.0.0",
      manifest: {
        id: "acme.demo",
        name: "Demo",
        version: "1.0.0",
        type: "service",
        forgeApi: "^0.1.0",
        entry: "index.js",
      },
    });
    const ctx = await context({
      persist,
      permissions: ["storage.read", "storage.write"],
    });
    await expect(
      ctx.storage.set("forge/service/state", { ok: true }),
    ).rejects.toBeInstanceOf(ForgeError);
    await expect(
      ctx.storage.set("fluxo/admin-config", { url: "https://evil.example" }),
    ).rejects.toBeInstanceOf(ForgeError);
    await persist.setKv("acme.demo", "forge/service/state", { host: true });
    await ctx.storage.set("state/item", { ok: true });
    expect(await ctx.storage.get("state/item")).toEqual({ ok: true });
    expect(await persist.getKv("acme.demo", "forge/service/state")).toEqual({
      host: true,
    });
  });
});

describe("plugin context jobs", () => {
  it("registers a PluginJobs handler and the scheduler invokes it", async () => {
    const ctx = await context({ permissions: ["jobs.schedule"] });
    const payloads: unknown[] = [];
    ctx.jobs.handle("tick", (payload) => {
      payloads.push(payload);
    });
    await ctx.jobs.schedule({
      name: "tick",
      delayMs: 0,
      payload: { n: 7 },
    });
    await waitFor(() => payloads.length === 1);
    expect(payloads).toEqual([{ n: 7 }]);
  });
});

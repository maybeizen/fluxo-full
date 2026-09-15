import {
  ForgePermissionError,
  type PluginLogger,
  type PluginPermission,
} from "@fluxo/forge";
import { UserRole } from "@fluxo/types";
import { describe, expect, it } from "vitest";
import { createMemoryUserStore } from "../auth/stores/memory.js";
import { createMemorySettingsRuntime } from "../settings/runtime.js";
import {
  createPluginContext,
  intersectPluginPermissions,
} from "./context.js";
import { createForgeEventBus } from "./events.js";
import { createJobScheduler } from "./jobs.js";
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
  return createPluginContext({
    pluginId: options.pluginId ?? "acme.demo",
    pluginVersion: "1.0.0",
    instanceId: options.instanceId,
    persist,
    permissions: options.permissions ?? [],
    logger,
    events: createForgeEventBus(),
    jobs: createJobScheduler({ logger, isPluginEnabled: () => true }),
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

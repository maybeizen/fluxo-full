import { REDACTED, type PluginLogger } from "@fluxo/forge";
import { describe, expect, it } from "vitest";
import { createPluginContext } from "./context.js";
import { createForgeEventBus } from "./events.js";
import { createJobScheduler } from "./jobs.js";
import { createPluginLogger } from "./logger.js";
import { createMemoryPluginPersist } from "./persist.js";

function capturingLogger(): { logger: PluginLogger; entries: unknown[] } {
  const entries: unknown[] = [];
  const create = (bindings: Record<string, unknown>): PluginLogger => ({
    debug(message, meta) {
      entries.push({ level: "debug", message, meta: { ...bindings, ...meta } });
    },
    info(message, meta) {
      entries.push({ level: "info", message, meta: { ...bindings, ...meta } });
    },
    warn(message, meta) {
      entries.push({ level: "warn", message, meta: { ...bindings, ...meta } });
    },
    error(message, meta) {
      entries.push({ level: "error", message, meta: { ...bindings, ...meta } });
    },
    child(next) {
      return create({ ...bindings, ...next });
    },
  });
  return { logger: create({}), entries };
}

describe("createPluginLogger", () => {
  it("redacts secret-like keys and known secret values", () => {
    const { logger, entries } = capturingLogger();
    const pluginLogger = createPluginLogger({
      logger,
      pluginId: "acme.demo",
      pluginVersion: "1.0.0",
      secrets: ["super-secret-value"],
    });

    pluginLogger.info("probe", {
      authorization: "Bearer super-secret-value",
      password: "hunter2",
      apiKey: "k-live",
      nested: { token: "abc", note: "super-secret-value is here" },
      visible: "ok",
    });

    const dumped = JSON.stringify(entries);
    expect(dumped).not.toContain("super-secret-value");
    expect(dumped).not.toContain("Bearer");
    expect(dumped).not.toContain("hunter2");
    expect(dumped).not.toContain("k-live");
    expect(dumped).toContain(REDACTED);
    expect(dumped).toContain("ok");
    expect(dumped).toContain("acme.demo");
  });

  it("redacts secrets passed through child bindings", () => {
    const { logger, entries } = capturingLogger();
    const pluginLogger = createPluginLogger({
      logger,
      pluginId: "acme.demo",
      pluginVersion: "1.2.0",
      instanceId: "inst-1",
      requestId: "req-9",
      secrets: ["tok_live"],
    });
    pluginLogger.child({ xApiKey: "tok_live" }).warn("child");
    const dumped = JSON.stringify(entries);
    expect(dumped).not.toContain("tok_live");
    expect(dumped).toContain(REDACTED);
  });
});

describe("plugin context logger", () => {
  it("does not log config secrets loaded from persist", async () => {
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: {
        id: "acme.mail",
        name: "Mail",
        version: "1.0.0",
        type: "service",
        forgeApi: "^0.1.0",
        entry: "index.js",
        config: [{ key: "api_token", type: "secret", label: "Token" }],
      },
    });
    const secret = "smtp-password-value";
    await persist.setSecret("acme.mail", "api_token", secret);
    const { logger, entries } = capturingLogger();
    const ctx = await createPluginContext({
      pluginId: "acme.mail",
      pluginVersion: "1.0.0",
      persist,
      permissions: [],
      logger,
      events: createForgeEventBus(),
      jobs: createJobScheduler({
        logger,
        isPluginEnabled: () => true,
      }),
    });
    ctx.logger.info("config dump", { all: ctx.config.all(), leaked: secret });
    expect(ctx.config.getSecret("api_token")).toBe(secret);
    expect(ctx.config.all()).not.toHaveProperty("api_token");
    expect(JSON.stringify(entries)).not.toContain(secret);
  });
});

import { tmpdir } from "node:os";
import path from "node:path";
import type { FluxoLogger } from "@fluxo/logger";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { createMemoryAuth } from "../auth/stores/memory.js";
import { createForgeHost } from "../forge/host.js";
import { createMemoryPluginPersist } from "../forge/persist.js";

const panelManifest = {
  id: "example-panel",
  name: "Example",
  version: "1.0.0",
  type: "panel" as const,
  forgeApi: "^0.1.0",
  entry: "index.js",
};

const mailManifest = {
  id: "acme.mail",
  name: "Mail",
  version: "1.0.0",
  type: "service" as const,
  forgeApi: "^0.1.0",
  entry: "index.js",
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

function setup() {
  const auth = createMemoryAuth();
  const persist = createMemoryPluginPersist();
  const logger = mockLogger();
  const forge = createForgeHost({
    persist,
    logger,
    pluginsDir: path.join(tmpdir(), "fluxo-forge-panel-plugins-empty"),
  });
  const app = createApp({
    logger,
    redis: { ping: async () => "PONG" },
    postgres: { ping: async () => undefined },
    corsOrigin: "http://localhost:5173",
    auth,
    forge,
  });
  return { app, persist };
}

describe("GET /plugins/panel", () => {
  it("returns enabled panel plugin ids without secrets or config", async () => {
    const { app, persist } = setup();
    await persist.upsertInstall({
      id: "example-panel",
      type: "panel",
      version: "1.0.0",
      manifest: panelManifest,
      enabled: true,
      status: "enabled",
    });
    await persist.upsertInstall({
      id: "quiet.panel",
      type: "panel",
      version: "1.0.0",
      manifest: { ...panelManifest, id: "quiet.panel", name: "Quiet" },
      enabled: false,
      status: "disabled",
    });
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
      enabled: true,
      status: "enabled",
    });
    await persist.setSecret("example-panel", "api_token", "tok_live_secret");

    const response = await app.request("/plugins/panel");
    expect(response.status).toBe(200);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toEqual({ pluginIds: ["example-panel"] });
    expect(JSON.stringify(body)).not.toContain("tok_live_secret");
    expect(body).not.toHaveProperty("config");
    expect(body).not.toHaveProperty("plugins");
  });

  it("is public", async () => {
    const { app } = setup();
    const response = await app.request("/plugins/panel");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pluginIds: [] });
  });
});

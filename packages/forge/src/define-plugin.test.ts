import type { FluxoLogger } from "@fluxo/logger";
import { describe, expect, it, vi } from "vitest";
import {
  definePlugin,
  defineServicePlugin,
  FORGE_API_VERSION,
} from "./index.js";
import type { FluxoPlugin, PluginContext } from "./index.js";

function mockLogger(): FluxoLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
}

function mockContext(): PluginContext {
  return {
    pluginId: "demo.plugin",
    logger: mockLogger(),
    config: {
      get: () => undefined,
      getSecret: () => undefined,
      all: () => ({}),
    },
    storage: {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
      keys: async () => [],
    },
    events: {
      on: () => () => undefined,
      onCustom: () => () => undefined,
      emitCustom: async () => undefined,
    },
    jobs: {
      schedule: async () => ({ jobId: "job" }),
      cancel: async () => undefined,
    },
    http: {
      request: async () => ({ status: 200, headers: {}, body: {} }),
    },
    users: {
      getById: async () => null,
    },
    settings: {
      getPublic: async () => ({
        appName: "Fluxo",
        appBaseUrl: "http://localhost:5173",
        billingCurrency: "USD",
        billingLocale: "en-US",
        billingTimezone: "UTC",
      }),
    },
  };
}

const baseManifest = {
  id: "demo.plugin",
  name: "Demo",
  version: "1.0.0",
  type: "panel" as const,
  forgeApi: `^${FORGE_API_VERSION}`,
  entry: "dist/index.js",
  frontend: "dist/frontend.js",
};

describe("definePlugin", () => {
  it("returns the same plugin contract", () => {
    const plugin: FluxoPlugin = {
      manifest: baseManifest,
    };
    expect(definePlugin(plugin)).toBe(plugin);
  });

  it("preserves optional lifecycle hooks", async () => {
    const onStart = vi.fn();
    const plugin = definePlugin({
      manifest: { ...baseManifest, description: "test" },
      onStart,
    });
    const ctx = mockContext();
    await plugin.onStart?.(ctx);
    expect(onStart).toHaveBeenCalledWith(ctx);
  });

  it("preserves legacy onLoad alias", async () => {
    const onLoad = vi.fn();
    const plugin = definePlugin({
      manifest: baseManifest,
      onLoad,
    });
    await plugin.onLoad?.(mockContext());
    expect(onLoad).toHaveBeenCalled();
  });
});

describe("defineServicePlugin", () => {
  it("returns a service plugin with provision methods", async () => {
    const plugin = defineServicePlugin({
      manifest: {
        ...baseManifest,
        id: "demo.service",
        type: "service",
      },
      capabilities: () => ["provision.create"],
      provisioningVariables: () => [],
      provision: async () => ({ status: "ok", remoteId: "remote-1" }),
    });
    const result = await plugin.provision(mockContext(), {
      idempotencyKey: "key-1",
      instanceId: "00000000-0000-4000-8000-000000000001",
      serviceId: "svc-1",
      userId: "00000000-0000-4000-8000-000000000002",
      action: "create",
      variables: {},
    });
    expect(result.remoteId).toBe("remote-1");
  });
});

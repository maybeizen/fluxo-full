import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parsePluginManifest,
  type PluginContext,
  type PluginLogger,
  type ProvisionRequest,
} from "@fluxo/forge";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "index.ts"),
  "utf8",
);
const PLUGIN_JSON = parsePluginManifest(
  JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../plugin.json"),
      "utf8",
    ) as unknown,
  ),
);

function fakeLogger(): PluginLogger {
  const logger: PluginLogger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => logger,
  };
  return logger;
}

function fakeContext(pluginId: string, instanceId: string): PluginContext {
  return {
    pluginId,
    instanceId,
    logger: fakeLogger(),
    config: {
      get: (key) =>
        key === "sandbox"
          ? true
          : key === "url"
            ? "https://example.invalid"
            : undefined,
      getSecret: () => undefined,
      all: () => ({ sandbox: true, url: "https://example.invalid" }),
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

function createRequest(
  instanceId: string,
  serviceId: string,
  action: ProvisionRequest["action"],
  idempotencyKey: string,
): ProvisionRequest {
  return {
    idempotencyKey,
    instanceId,
    serviceId,
    userId: "user-1",
    action,
    variables: { hostname: "node-1", slots: 2, region: "local" },
  };
}

describe("example-service", () => {
  it("matches plugin.json and uses only public Forge APIs", () => {
    expect(plugin.manifest).toEqual(PLUGIN_JSON);
    expect(plugin.manifest.id).toBe("example-service");
    expect(plugin.manifest.type).toBe("service");
    expect(SOURCE).not.toMatch(
      /@fluxo\/db|@fluxo\/plugin-manager|prisma|theme-system/,
    );
    expect(plugin.capabilities()).toEqual(
      expect.arrayContaining(["provision.create", "provision.suspend"]),
    );
    expect(plugin.provisioningVariables().map((field) => field.key)).toEqual([
      "hostname",
      "slots",
      "region",
    ]);
  });

  it("provisions, suspends, and terminates in memory with idempotency", async () => {
    const ctx = fakeContext("example-service", "inst-a");
    const created = await plugin.provision(
      ctx,
      createRequest("inst-a", "svc-1", "create", "idem-1"),
    );
    expect(created.status).toBe("ok");
    expect(created.remoteId).toBe("svc_inst-a_svc-1");
    expect(created.idempotentReplay).toBeUndefined();

    const replay = await plugin.provision(
      ctx,
      createRequest("inst-a", "svc-1", "create", "idem-1"),
    );
    expect(replay.remoteId).toBe(created.remoteId);
    expect(replay.idempotentReplay).toBe(true);

    const suspended = await plugin.provision(
      ctx,
      createRequest("inst-a", "svc-1", "suspend", "idem-suspend"),
    );
    expect(suspended.status).toBe("ok");
    expect(suspended.runtime?.state).toBe("suspended");

    const current = await plugin.reconcile?.(ctx, {
      instanceId: "inst-a",
      serviceId: "svc-1",
      remoteId: created.remoteId,
    });
    expect(current?.remoteId).toBe(created.remoteId);
    expect(current?.runtime?.state).toBe("suspended");

    const terminated = await plugin.provision(
      ctx,
      createRequest("inst-a", "svc-1", "terminate", "idem-term"),
    );
    expect(terminated.status).toBe("ok");
  });

  it("keeps two instances isolated", async () => {
    const east = fakeContext("example-service", "east");
    const west = fakeContext("example-service", "west");
    const eastResult = await plugin.provision(
      east,
      createRequest("east", "shared", "create", "idem"),
    );
    const westResult = await plugin.provision(
      west,
      createRequest("west", "shared", "create", "idem"),
    );
    expect(eastResult.remoteId).toBe("svc_east_shared");
    expect(westResult.remoteId).toBe("svc_west_shared");
    expect(eastResult.remoteId).not.toBe(westResult.remoteId);

    await plugin.provision(
      east,
      createRequest("east", "shared", "suspend", "s1"),
    );
    const eastState = await plugin.reconcile?.(east, {
      instanceId: "east",
      serviceId: "shared",
    });
    const westState = await plugin.reconcile?.(west, {
      instanceId: "west",
      serviceId: "shared",
    });
    expect(eastState?.runtime?.state).toBe("suspended");
    expect(westState?.runtime?.state).toBe("active");
  });
});

import {
  FORGE_HEALTH_TIMEOUT_MS,
  FluxoServicePlugin,
  ForgeConflictError,
  ForgeError,
  ForgeNotFoundError,
  ForgeTimeoutError,
  ForgeValidationError,
  SERVICE_CAPABILITIES,
  forgeErrorBody,
  parsePluginManifest,
  type PluginContext,
  type PluginLogger,
  type ProvisionRequest,
  type ProvisionResult,
  type ServiceCapability,
} from "@fluxo/forge";
import { describe, expect, it } from "vitest";
import { createMemoryPluginPersist, createPluginStorage } from "./persist.js";
import { createServiceRegistry, type ServiceRegistryDeps } from "./service-registry.js";

const SERVICE_ID = "acme.compute";
const GATEWAY_ID = "acme.pay";
const SECRET = "supersecret-api-token";

const serviceManifest = parsePluginManifest({
  id: SERVICE_ID,
  name: "Compute",
  version: "1.0.0",
  type: "service",
  forgeApi: "^0.1.0",
  entry: "index.js",
});

const gatewayManifest = {
  id: GATEWAY_ID,
  name: "Pay",
  version: "1.0.0",
  type: "gateway" as const,
  forgeApi: "^0.1.0",
  entry: "index.js",
};

class TestServicePlugin extends FluxoServicePlugin {
  readonly manifest = serviceManifest;
  provisionImpl?: (
    ctx: PluginContext,
    request: ProvisionRequest,
  ) => Promise<ProvisionResult>;
  healthImpl?: (
    ctx: PluginContext,
    signal: AbortSignal,
  ) => Promise<{ status: "ok" | "degraded" | "unhealthy"; message?: string }>;
  advertised: readonly ServiceCapability[] = [
    "provision.create",
    "provision.suspend",
    "provision.unsuspend",
    "provision.terminate",
    "provision.reconcile",
    "usage.view",
  ];

  capabilities(): readonly ServiceCapability[] {
    return this.advertised;
  }

  provisioningVariables() {
    return [];
  }

  async provision(ctx: PluginContext, request: ProvisionRequest): Promise<ProvisionResult> {
    if (this.provisionImpl) {
      return this.provisionImpl(ctx, request);
    }
    return {
      status: "ok",
      remoteId: `remote-${request.serviceId}-${ctx.instanceId ?? "none"}`,
      runtime: { operationId: `op-${request.idempotencyKey}` },
    };
  }

  async health(ctx: PluginContext, signal: AbortSignal) {
    if (this.healthImpl) {
      return this.healthImpl(ctx, signal);
    }
    return { status: "ok" as const };
  }
}

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

function fakeContext(
  persist: ReturnType<typeof createMemoryPluginPersist>,
  pluginId: string,
  instanceId: string,
): PluginContext {
  return {
    pluginId,
    instanceId,
    logger: fakeLogger(),
    config: {
      get: () => undefined,
      getSecret: () => undefined,
      all: () => ({}),
    },
    storage: createPluginStorage(persist, pluginId),
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

async function seedServiceInstall(
  persist: ReturnType<typeof createMemoryPluginPersist>,
  options?: { enabled?: boolean; status?: "enabled" | "started" | "disabled" | "error" },
) {
  return persist.upsertInstall({
    id: SERVICE_ID,
    type: "service",
    version: "1.0.0",
    manifest: serviceManifest,
    enabled: options?.enabled ?? true,
    status: options?.status ?? "started",
  });
}

function createHarness(
  options?: {
    plugin?: TestServicePlugin;
    active?: boolean;
    persist?: ReturnType<typeof createMemoryPluginPersist>;
    healthTimeoutMs?: number;
  },
) {
  const persist = options?.persist ?? createMemoryPluginPersist();
  const plugin = options?.plugin ?? new TestServicePlugin();
  const active = options?.active ?? true;
  const deps: ServiceRegistryDeps = {
    persist,
    getServicePlugin: (pluginId) => (pluginId === SERVICE_ID ? plugin : undefined),
    isPluginActive: (pluginId) => active && pluginId === SERVICE_ID,
    createContext: (pluginId, instanceId) => fakeContext(persist, pluginId, instanceId),
    ...(options?.healthTimeoutMs === undefined
      ? {}
      : { healthTimeoutMs: options.healthTimeoutMs }),
  };
  return {
    persist,
    plugin,
    registry: createServiceRegistry(deps),
  };
}

function provisionInput(
  serviceId: string,
  idempotencyKey = "idem-1",
): Omit<ProvisionRequest, "instanceId" | "action"> {
  return {
    idempotencyKey,
    serviceId,
    userId: "user-1",
    variables: { hostname: "node-1" },
  };
}

describe("createServiceRegistry", () => {
  it("resolves two instances of the same plugin independently", async () => {
    const { persist, registry } = createHarness();
    await seedServiceInstall(persist);
    const east = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "East",
      enabled: true,
    });
    const west = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "West",
      enabled: true,
    });

    const listed = await registry.listInstances(SERVICE_ID);
    expect(listed).toHaveLength(2);
    expect(listed.map((item) => item.displayName).sort()).toEqual(["East", "West"]);

    const eastProvider = await registry.resolve(east.id);
    const westProvider = await registry.resolve(west.id);
    expect(eastProvider.pluginId).toBe(SERVICE_ID);
    expect(westProvider.pluginId).toBe(SERVICE_ID);
    expect(eastProvider.instance.id).toBe(east.id);
    expect(westProvider.instance.id).toBe(west.id);
    expect(eastProvider.instance.displayName).toBe("East");
    expect(westProvider.instance.displayName).toBe("West");

    const eastResult = await eastProvider.provisionService(provisionInput("svc-shared"));
    const westResult = await westProvider.provisionService(provisionInput("svc-shared"));
    expect(eastResult.remoteId).toBe(`remote-svc-shared-${east.id}`);
    expect(westResult.remoteId).toBe(`remote-svc-shared-${west.id}`);
    expect(eastResult.remoteId).not.toBe(westResult.remoteId);

    const eastState = await persist.getKv(
      SERVICE_ID,
      `forge/service/${east.id}/svc-shared/state`,
    );
    const westState = await persist.getKv(
      SERVICE_ID,
      `forge/service/${west.id}/svc-shared/state`,
    );
    expect(eastState).toMatchObject({ remoteId: eastResult.remoteId });
    expect(westState).toMatchObject({ remoteId: westResult.remoteId });
  });

  it("returns a typed error when the instance is missing", async () => {
    const { persist, registry } = createHarness();
    await seedServiceInstall(persist);
    await expect(
      registry.resolve("11111111-1111-4111-8111-111111111111"),
    ).rejects.toBeInstanceOf(ForgeNotFoundError);
  });

  it("returns a typed error when the plugin is disabled", async () => {
    const persist = createMemoryPluginPersist();
    await seedServiceInstall(persist, { enabled: true, status: "started" });
    const instance = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });
    await persist.setInstanceEnabled(instance.id, false);
    await persist.setEnabled(SERVICE_ID, false);
    await persist.setInstanceEnabled(instance.id, true);

    const registry = createServiceRegistry({
      persist,
      getServicePlugin: () => new TestServicePlugin(),
      isPluginActive: () => false,
      createContext: (pluginId, instanceId) => fakeContext(persist, pluginId, instanceId),
    });
    await expect(registry.resolve(instance.id)).rejects.toBeInstanceOf(ForgeConflictError);
    await expect(registry.resolve(instance.id)).rejects.toThrow("Service plugin is disabled");
  });

  it("returns a typed error when the instance is disabled", async () => {
    const { persist, registry } = createHarness();
    await seedServiceInstall(persist);
    const instance = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "Primary",
      enabled: false,
    });
    await expect(registry.resolve(instance.id)).rejects.toBeInstanceOf(ForgeConflictError);
    await expect(registry.resolve(instance.id)).rejects.toThrow("Service instance is disabled");
    expect(await registry.getInstance(instance.id)).toMatchObject({
      id: instance.id,
      enabled: false,
    });
  });

  it("rejects a gateway instance as the wrong plugin type", async () => {
    const { persist, registry } = createHarness();
    await persist.upsertInstall({
      id: GATEWAY_ID,
      type: "gateway",
      version: "1.0.0",
      manifest: gatewayManifest,
      enabled: true,
      status: "started",
    });
    const instance = await persist.createInstance({
      pluginId: GATEWAY_ID,
      kind: "gateway",
      displayName: "Checkout",
      enabled: true,
    });
    await expect(registry.resolve(instance.id)).rejects.toBeInstanceOf(ForgeValidationError);
    await expect(registry.resolve(instance.id)).rejects.toThrow("Instance is not a service provider");
    expect(await registry.getInstance(instance.id)).toBeNull();
    expect(await registry.listInstances()).toEqual([]);
  });

  it("advertises capabilities without checking plugin id", async () => {
    const plugin = new TestServicePlugin();
    plugin.advertised = ["provision.create", "usage.view", "pterodactyl.console" as ServiceCapability];
    const { persist, registry } = createHarness({ plugin });
    await seedServiceInstall(persist);
    const instance = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });
    const provider = await registry.resolve(instance.id);
    expect(provider.pluginId).toBe(SERVICE_ID);
    expect(provider.supports("provision.create")).toBe(true);
    expect(provider.supports("usage.view")).toBe(true);
    expect(provider.supports("backup.create")).toBe(false);
    expect(provider.capabilities()).toEqual(["provision.create", "usage.view"]);
    expect(provider.capabilities().every((capability) => SERVICE_CAPABILITIES.includes(capability))).toBe(
      true,
    );
    expect(SERVICE_CAPABILITIES.includes("pterodactyl.console" as ServiceCapability)).toBe(false);
  });

  it("isolates provision throws without leaking secrets", async () => {
    const plugin = new TestServicePlugin();
    plugin.provisionImpl = async () => {
      throw new Error(`upstream failed token=${SECRET}\n    at Plugin.provision`);
    };
    const { persist, registry } = createHarness({ plugin });
    await seedServiceInstall(persist);
    const instance = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });
    const provider = await registry.resolve(instance.id);
    const error = await provider.provisionService(provisionInput("svc-1")).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ForgeError);
    expect((error as ForgeError).message).toBe("Service plugin operation failed");
    expect((error as ForgeError).message).not.toContain(SECRET);
    expect(JSON.stringify(forgeErrorBody(error as ForgeError))).not.toContain(SECRET);
    expect(JSON.stringify(forgeErrorBody(error as ForgeError))).not.toContain("at Plugin.provision");
  });

  it("persists remote id and idempotency or operation id fields", async () => {
    const { persist, registry } = createHarness();
    await seedServiceInstall(persist);
    const instance = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });
    const provider = await registry.resolve(instance.id);
    const first = await provider.provisionService(provisionInput("svc-1", "idem-create"));
    expect(first.status).toBe("ok");
    expect(first.remoteId).toBe(`remote-svc-1-${instance.id}`);
    expect(first.operationId).toBe("op-idem-create");
    expect(first.idempotentReplay).toBeUndefined();

    const replay = await provider.provisionService(provisionInput("svc-1", "idem-create"));
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.remoteId).toBe(first.remoteId);
    expect(replay.operationId).toBe(first.operationId);

    const state = await persist.getKv(SERVICE_ID, `forge/service/${instance.id}/svc-1/state`);
    expect(state).toMatchObject({
      remoteId: first.remoteId,
      operationId: first.operationId,
      status: "ok",
    });
    const keys = await persist.listKvKeys(SERVICE_ID, `forge/service/${instance.id}/svc-1/`);
    expect(keys.some((key) => key.includes("/idemp/"))).toBe(true);
    expect(keys.some((key) => key.endsWith("/state"))).toBe(true);
  });

  it("times out health checks and strips secrets from health errors", async () => {
    const plugin = new TestServicePlugin();
    plugin.healthImpl = async (_ctx, signal) =>
      new Promise((_, reject) => {
        const fail = () => {
          reject(new Error(`health token=${SECRET}`));
        };
        if (signal.aborted) {
          fail();
          return;
        }
        signal.addEventListener("abort", fail);
      });
    const { persist, registry } = createHarness({ plugin, healthTimeoutMs: 30 });
    await seedServiceInstall(persist);
    const instance = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });
    const provider = await registry.resolve(instance.id);
    const error = await provider.health().catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ForgeTimeoutError);
    expect((error as ForgeTimeoutError).message).toBe("Service health check timed out");
    expect((error as ForgeTimeoutError).message).not.toContain(SECRET);
    expect(JSON.stringify(forgeErrorBody(error as ForgeError))).not.toContain(SECRET);
    expect(FORGE_HEALTH_TIMEOUT_MS).toBe(5000);
  });

  it("redacts secret health messages from successful checks", async () => {
    const plugin = new TestServicePlugin();
    plugin.healthImpl = async () => ({ status: "ok", message: `connected token=${SECRET}` });
    const { persist, registry } = createHarness({ plugin });
    await seedServiceInstall(persist);
    const instance = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });
    const snapshot = await (await registry.resolve(instance.id)).health();
    expect(snapshot.status).toBe("ok");
    expect(snapshot.message).not.toContain(SECRET);
    expect(JSON.stringify(snapshot)).not.toContain(SECRET);
  });

  it("fails closed when a plugin is in the error state", async () => {
    const persist = createMemoryPluginPersist();
    await seedServiceInstall(persist, { enabled: true, status: "error" });
    const instance = await persist.createInstance({
      pluginId: SERVICE_ID,
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });
    const registry = createServiceRegistry({
      persist,
      getServicePlugin: () => new TestServicePlugin(),
      isPluginActive: () => true,
      createContext: (pluginId, instanceId) => fakeContext(persist, pluginId, instanceId),
    });
    const error = await registry.resolve(instance.id).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ForgeError);
    expect((error as ForgeError).code).toBe("forge_plugin_failed");
  });
});

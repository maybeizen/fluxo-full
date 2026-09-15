import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type CreateCheckoutRequest,
  type FluxoGatewayPlugin,
  type FluxoServicePlugin,
  type PluginContext,
  type PluginLogger,
  type ProvisionRequest,
} from "@fluxo/forge";
import { describe, expect, it } from "vitest";
import {
  createFakeLogger,
  createFakePluginContext,
  createMemoryInstallStore,
  createPluginManager,
} from "@fluxo/plugin-manager";
import { createGatewayRegistry } from "./gateway-registry.js";
import { createMemoryPluginPersist, createPluginStorage } from "./persist.js";
import { createServiceRegistry } from "./service-registry.js";

const WORKSPACE_PLUGINS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../plugins",
);
const SERVICE_EAST = "11111111-1111-4111-8111-111111111111";
const SERVICE_WEST = "22222222-2222-4222-8222-222222222222";
const GATEWAY_EAST = "33333333-3333-4333-8333-333333333333";
const GATEWAY_WEST = "44444444-4444-4444-8444-444444444444";

function logger(): PluginLogger {
  return createFakeLogger();
}

function context(
  persist: ReturnType<typeof createMemoryPluginPersist>,
  pluginId: string,
  instanceId?: string,
): PluginContext {
  const base = createFakePluginContext(pluginId, logger());
  return {
    ...base,
    ...(instanceId === undefined ? {} : { instanceId }),
    storage: createPluginStorage(persist, pluginId),
    config: {
      get: (key) =>
        key === "sandbox"
          ? true
          : key === "url"
            ? "https://example.invalid"
            : undefined,
      getSecret: (key) => (key === "secret" ? "shared-secret" : undefined),
      all: () => ({ sandbox: true, url: "https://example.invalid" }),
    },
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
    variables: { hostname: "node-1", slots: 1, region: "local" },
  };
}

function checkoutRequest(instanceId: string): CreateCheckoutRequest {
  return {
    idempotencyKey: `idem-${instanceId}`,
    instanceId,
    invoiceId: "inv-1",
    amount: { amount: 2500, currency: "USD" },
    customer: { userId: "user-1", email: "ada@example.com" },
    returnUrl: "https://app.example/return",
    cancelUrl: "https://app.example/cancel",
  };
}

async function loadExamples() {
  const store = createMemoryInstallStore({
    "example-service": { installed: true, enabled: true },
    "example-gateway": { installed: true, enabled: true },
    "example-panel": { installed: true, enabled: true },
  });
  const manager = createPluginManager({
    directory: WORKSPACE_PLUGINS,
    logger: logger(),
    createContext: (pluginId) => createFakePluginContext(pluginId),
    getInstallState: store.getInstallState,
    setInstallState: store.setInstallState,
  });
  await manager.loadAll();
  return manager;
}

describe("example plugin registries", () => {
  it("creates two example-service instances via persist and the service registry", async () => {
    const manager = await loadExamples();
    const plugin = manager.getActive("example-service") as
      FluxoServicePlugin | undefined;
    expect(typeof plugin?.provision).toBe("function");
    expect(typeof plugin?.capabilities).toBe("function");
    const servicePlugin = plugin as FluxoServicePlugin;

    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "example-service",
      type: "service",
      version: servicePlugin.manifest.version,
      manifest: servicePlugin.manifest,
      enabled: true,
      status: "started",
    });
    const east = await persist.createInstance({
      id: SERVICE_EAST,
      pluginId: "example-service",
      kind: "service",
      displayName: "East",
      enabled: true,
    });
    const west = await persist.createInstance({
      id: SERVICE_WEST,
      pluginId: "example-service",
      kind: "service",
      displayName: "West",
      enabled: true,
    });

    const registry = createServiceRegistry({
      persist,
      getServicePlugin: (pluginId) =>
        pluginId === "example-service" ? servicePlugin : undefined,
      isPluginActive: (pluginId) => manager.getActive(pluginId) !== undefined,
      createContext: (pluginId, instanceId) =>
        context(persist, pluginId, instanceId),
    });

    const listed = await registry.listInstances("example-service");
    expect(listed).toHaveLength(2);

    const eastProvider = await registry.resolve(east.id);
    const westProvider = await registry.resolve(west.id);
    expect(eastProvider.supports("provision.create")).toBe(true);
    expect(westProvider.supports("provision.suspend")).toBe(true);
    expect(eastProvider.supports("provision.modify")).toBe(true);
    expect(eastProvider.supports("access.console")).toBe(false);

    const eastResult = await eastProvider.provisionService(
      provisionInput("shared"),
    );
    const westResult = await westProvider.provisionService(
      provisionInput("shared"),
    );
    expect(eastResult.remoteId).toBe(`svc_${east.id}_shared`);
    expect(westResult.remoteId).toBe(`svc_${west.id}_shared`);
    expect(eastResult.remoteId).not.toBe(westResult.remoteId);

    const eastGet = await eastProvider.getService({ serviceId: "shared" });
    const westGet = await westProvider.getService({ serviceId: "shared" });
    expect(eastGet.remoteId).toBe(eastResult.remoteId);
    expect(westGet.remoteId).toBe(westResult.remoteId);
  });

  it("lets two example-gateway instances coexist", async () => {
    const manager = await loadExamples();
    const plugin = manager.getActive("example-gateway") as
      FluxoGatewayPlugin | undefined;
    expect(typeof plugin?.createCheckout).toBe("function");
    const gatewayPlugin = plugin as FluxoGatewayPlugin;

    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "example-gateway",
      type: "gateway",
      version: gatewayPlugin.manifest.version,
      manifest: gatewayPlugin.manifest,
      enabled: true,
      status: "started",
    });
    const east = await persist.createInstance({
      id: GATEWAY_EAST,
      pluginId: "example-gateway",
      kind: "gateway",
      displayName: "East",
      enabled: true,
    });
    const west = await persist.createInstance({
      id: GATEWAY_WEST,
      pluginId: "example-gateway",
      kind: "gateway",
      displayName: "West",
      enabled: true,
    });

    const registry = createGatewayRegistry({
      persist,
      getGatewayPlugin: (pluginId) =>
        pluginId === "example-gateway" ? gatewayPlugin : undefined,
      isPluginActive: (pluginId) => manager.getActive(pluginId) !== undefined,
      createContext: (pluginId, instanceId) =>
        context(persist, pluginId, instanceId),
    });

    expect(await registry.listInstances("example-gateway")).toHaveLength(2);
    const eastCheckout = await registry.createCheckout(
      checkoutRequest(east.id),
    );
    const westCheckout = await registry.createCheckout(
      checkoutRequest(west.id),
    );
    expect(eastCheckout.checkoutId).not.toBe(westCheckout.checkoutId);
    expect(eastCheckout.mode).toBe("redirect");
    expect(westCheckout).not.toHaveProperty("cardNumber");

    await expect(
      registry.getPaymentStatus({
        instanceId: west.id,
        checkoutId: eastCheckout.checkoutId,
      }),
    ).rejects.toBeTruthy();

    await expect(
      registry.getPaymentStatus({
        instanceId: east.id,
        checkoutId: eastCheckout.checkoutId,
      }),
    ).resolves.toBe("pending");
    await expect(
      registry.getPaymentStatus({
        instanceId: west.id,
        checkoutId: westCheckout.checkoutId,
      }),
    ).resolves.toBe("pending");
  });
});

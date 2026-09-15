import {
  ForgeError,
  ForgeNotFoundError,
  ForgePermissionError,
  ForgeValidationError,
  type CreateCheckoutRequest,
  type FluxoGatewayPlugin,
  type PluginContext,
  type PluginLogger,
  type PluginManifest,
  type PluginWebhookRequest,
  type PluginWebhookResult,
} from "@fluxo/forge";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createForgeEventBus, setActiveForgeEventBus } from "./events.js";
import {
  GatewayInstanceDisabledError,
  GatewayNotFoundError,
  GatewayPluginDisabledError,
  GatewayWrongTypeError,
  createGatewayRegistry,
  gatewayRegistryMethodNames,
} from "./gateway-registry.js";
import { createMemoryPluginPersist } from "./persist.js";

const PAY_ID = "acme.pay";
const OTHER_ID = "acme.altpay";
const INSTANCE_A = "11111111-1111-4111-8111-111111111111";
const INSTANCE_B = "22222222-2222-4222-8222-222222222222";
const SERVICE_INSTANCE = "33333333-3333-4333-8333-333333333333";

const payManifest: PluginManifest = {
  id: PAY_ID,
  name: "Pay",
  version: "1.0.0",
  type: "gateway",
  forgeApi: "^0.1.0",
  entry: "index.js",
  permissions: [
    "billing.checkout",
    "billing.refund",
    "billing.webhook",
    "webhooks.receive",
  ],
};

const altManifest: PluginManifest = {
  ...payManifest,
  id: OTHER_ID,
  name: "Alt Pay",
};

const serviceManifest: PluginManifest = {
  id: "acme.mail",
  name: "Mail",
  version: "1.0.0",
  type: "service",
  forgeApi: "^0.1.0",
  entry: "index.js",
};

function fakeLogger(): PluginLogger {
  const logger: PluginLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

function fakeContext(pluginId: string, instanceId?: string): PluginContext {
  return {
    pluginId,
    ...(instanceId === undefined ? {} : { instanceId }),
    logger: fakeLogger(),
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
      handle: () => () => undefined,
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

function checkoutRequest(instanceId: string): CreateCheckoutRequest {
  return {
    idempotencyKey: "idem-1",
    instanceId,
    invoiceId: "inv_1",
    amount: { amount: 1999, currency: "USD" },
    customer: { userId: "user_1", email: "ada@example.com" },
    returnUrl: "https://app.example/return",
    cancelUrl: "https://app.example/cancel",
  };
}

function gatewayPlugin(
  id: string,
  overrides?: Partial<FluxoGatewayPlugin> & {
    webhookHandlers?: () => readonly string[];
    throwOn?: string;
    secretThrow?: boolean;
    healthMessage?: string;
    healthDelayMs?: number;
  },
): FluxoGatewayPlugin {
  const plugin: FluxoGatewayPlugin & {
    webhookHandlers?: () => readonly string[];
    lastCheckout?: CreateCheckoutRequest;
  } = {
    manifest: id === OTHER_ID ? altManifest : payManifest,
    webhookHandlers: overrides?.webhookHandlers ?? (() => ["notify"]),
    async createCheckout(_ctx, request) {
      if (overrides?.throwOn === "createCheckout") {
        throw overrides.secretThrow
          ? new Error("sk_live_leaked_secret")
          : new Error("psp down");
      }
      plugin.lastCheckout = request;
      return {
        mode: "redirect",
        checkoutId: `chk_${request.instanceId.slice(0, 8)}`,
        redirectUrl: "https://psp.example/pay",
        status: "pending",
      };
    },
    async getPaymentStatus(_ctx, request) {
      if (overrides?.throwOn === "getPaymentStatus") {
        throw new Error("status failed");
      }
      return request.checkoutId.endsWith("done") ? "completed" : "pending";
    },
    async refund(_ctx, request) {
      if (overrides?.throwOn === "refund") {
        throw new Error("refund failed");
      }
      return {
        refundId: "re_1",
        status: "refunded",
        amount: request.amount ?? { amount: 1999, currency: "USD" },
      };
    },
    async handleWebhook(
      _ctx: PluginContext,
      request: PluginWebhookRequest,
    ): Promise<PluginWebhookResult> {
      if (overrides?.throwOn === "handleWebhook") {
        throw new Error("sk_live_webhook_secret");
      }
      return {
        status: 200,
        recognized: true,
        body: { ok: true, instanceId: request.instanceId },
      };
    },
    async health(_ctx, signal) {
      if (overrides?.healthDelayMs !== undefined) {
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(resolve, overrides.healthDelayMs);
          signal.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(new Error("aborted"));
          });
        });
      }
      if (overrides?.throwOn === "health") {
        throw new Error("whsec_health_secret");
      }
      return {
        status: "ok",
        ...(overrides?.healthMessage === undefined
          ? {}
          : { message: overrides.healthMessage }),
      };
    },
    ...overrides,
  };
  return plugin;
}

async function setup(options?: {
  active?: (pluginId: string) => boolean;
  plugins?: Map<string, FluxoGatewayPlugin>;
  healthTimeoutMs?: number;
}) {
  const persist = createMemoryPluginPersist();
  await persist.upsertInstall({
    id: PAY_ID,
    type: "gateway",
    version: "1.0.0",
    manifest: payManifest,
    enabled: true,
    status: "started",
  });
  await persist.upsertInstall({
    id: OTHER_ID,
    type: "gateway",
    version: "1.0.0",
    manifest: altManifest,
    enabled: true,
    status: "started",
  });
  await persist.upsertInstall({
    id: "acme.mail",
    type: "service",
    version: "1.0.0",
    manifest: serviceManifest,
    enabled: true,
    status: "started",
  });
  await persist.createInstance({
    id: INSTANCE_A,
    pluginId: PAY_ID,
    kind: "gateway",
    displayName: "Primary",
    enabled: true,
  });
  await persist.createInstance({
    id: INSTANCE_B,
    pluginId: PAY_ID,
    kind: "gateway",
    displayName: "Backup",
    enabled: true,
  });
  await persist.createInstance({
    id: SERVICE_INSTANCE,
    pluginId: "acme.mail",
    kind: "service",
    displayName: "Mail",
    enabled: true,
  });

  const plugins =
    options?.plugins ??
    new Map<string, FluxoGatewayPlugin>([
      [PAY_ID, gatewayPlugin(PAY_ID)],
      [OTHER_ID, gatewayPlugin(OTHER_ID)],
    ]);

  const registry = createGatewayRegistry({
    persist,
    getGatewayPlugin: (pluginId) => plugins.get(pluginId),
    isPluginActive: options?.active ?? ((pluginId) => plugins.has(pluginId)),
    createContext: (pluginId, instanceId) => fakeContext(pluginId, instanceId),
    healthTimeoutMs: options?.healthTimeoutMs,
  });

  return { persist, plugins, registry };
}

describe("createGatewayRegistry", () => {
  afterEach(() => {
    setActiveForgeEventBus(undefined);
  });

  it("lets two gateway instances of the same plugin coexist", async () => {
    const { registry, plugins } = await setup();
    const listed = await registry.listInstances(PAY_ID);
    expect(listed).toHaveLength(2);
    expect(listed.map((row) => row.id).sort()).toEqual([
      INSTANCE_A,
      INSTANCE_B,
    ]);
    expect(listed.every((row) => row.pluginId === PAY_ID)).toBe(true);

    const first = await registry.createCheckout(checkoutRequest(INSTANCE_A));
    const second = await registry.createCheckout(checkoutRequest(INSTANCE_B));
    expect(first.checkoutId).not.toBe(second.checkoutId);
    expect(first.mode).toBe("redirect");
    expect(first.redirectUrl).toBe("https://psp.example/pay");
    expect(second.status).toBe("pending");

    const plugin = plugins.get(PAY_ID) as FluxoGatewayPlugin & {
      lastCheckout?: CreateCheckoutRequest;
    };
    expect(plugin.lastCheckout?.instanceId).toBe(INSTANCE_B);

    const resolvedA = await registry.resolve(INSTANCE_A);
    const resolvedB = await registry.resolve(INSTANCE_B);
    expect(resolvedA.instance.id).toBe(INSTANCE_A);
    expect(resolvedB.instance.id).toBe(INSTANCE_B);
    expect(resolvedA.pluginId).toBe(PAY_ID);
    expect(resolvedB.pluginId).toBe(PAY_ID);
  });

  it("throws typed errors for missing, disabled plugin, disabled instance, and wrong type", async () => {
    const { registry, persist } = await setup({
      active: (pluginId) => pluginId === PAY_ID,
    });

    await expect(
      registry.resolve("44444444-4444-4444-8444-444444444444"),
    ).rejects.toBeInstanceOf(GatewayNotFoundError);
    await expect(
      registry.resolve("44444444-4444-4444-8444-444444444444"),
    ).rejects.toBeInstanceOf(ForgeNotFoundError);

    await persist.setInstanceEnabled(INSTANCE_A, false);
    await expect(registry.resolve(INSTANCE_A)).rejects.toBeInstanceOf(
      GatewayInstanceDisabledError,
    );

    await persist.setInstanceEnabled(INSTANCE_A, true);
    const disabledRegistry = createGatewayRegistry({
      persist,
      getGatewayPlugin: () => gatewayPlugin(PAY_ID),
      isPluginActive: () => false,
      createContext: (pluginId, instanceId) =>
        fakeContext(pluginId, instanceId),
    });
    await expect(disabledRegistry.resolve(INSTANCE_A)).rejects.toBeInstanceOf(
      GatewayPluginDisabledError,
    );

    await expect(registry.resolve(SERVICE_INSTANCE)).rejects.toBeInstanceOf(
      GatewayWrongTypeError,
    );
    await expect(registry.getInstance(SERVICE_INSTANCE)).resolves.toBeNull();
    await expect(
      registry.getInstance("44444444-4444-4444-8444-444444444444"),
    ).resolves.toBeNull();
  });

  it("exposes no card-number or CVC APIs", async () => {
    const { registry } = await setup();
    const names = [...gatewayRegistryMethodNames(), ...Object.keys(registry)];
    expect(names.some((name) => /card|cvc|cvv|pan/i.test(name))).toBe(false);
    expect(registry).not.toHaveProperty("chargeCard");
    expect(registry).not.toHaveProperty("createPaymentIntent");
    expect(typeof registry.createCheckout).toBe("function");
    expect(typeof registry.getPaymentStatus).toBe("function");
    expect(typeof registry.refund).toBe("function");

    const received = await registry.createCheckout(checkoutRequest(INSTANCE_A));
    expect(received).not.toHaveProperty("cardNumber");
    expect(received).not.toHaveProperty("cvc");
    expect(Object.keys(checkoutRequest(INSTANCE_A)).sort()).toEqual(
      [
        "amount",
        "cancelUrl",
        "customer",
        "idempotencyKey",
        "instanceId",
        "invoiceId",
        "returnUrl",
      ].sort(),
    );
  });

  it("isolates plugin throws without leaking secrets", async () => {
    const secretPlugin = gatewayPlugin(PAY_ID, {
      throwOn: "createCheckout",
      secretThrow: true,
    });
    const healthyPlugin = gatewayPlugin(OTHER_ID);
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: PAY_ID,
      type: "gateway",
      version: "1.0.0",
      manifest: payManifest,
      enabled: true,
      status: "started",
    });
    await persist.upsertInstall({
      id: OTHER_ID,
      type: "gateway",
      version: "1.0.0",
      manifest: altManifest,
      enabled: true,
      status: "started",
    });
    const otherInstance = "55555555-5555-4555-8555-555555555555";
    await persist.createInstance({
      id: INSTANCE_A,
      pluginId: PAY_ID,
      kind: "gateway",
      displayName: "Primary",
      enabled: true,
    });
    await persist.createInstance({
      id: otherInstance,
      pluginId: OTHER_ID,
      kind: "gateway",
      displayName: "Other",
      enabled: true,
    });
    const registry = createGatewayRegistry({
      persist,
      getGatewayPlugin: (pluginId) =>
        pluginId === PAY_ID ? secretPlugin : healthyPlugin,
      isPluginActive: () => true,
      createContext: (pluginId, instanceId) =>
        fakeContext(pluginId, instanceId),
    });

    let thrown: unknown;
    try {
      await registry.createCheckout(checkoutRequest(INSTANCE_A));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ForgeError);
    expect(thrown).not.toBeInstanceOf(ForgeValidationError);
    const failure = thrown as ForgeError;
    expect(failure.code).toBe("forge_gateway");
    expect(failure.status).toBe(500);
    expect(failure.message).toBe("createCheckout failed");
    expect(failure.message).not.toContain("sk_live");
    expect(failure.stack ?? "").not.toContain("sk_live_leaked_secret");

    const other = await registry.createCheckout(checkoutRequest(otherInstance));
    expect(other.status).toBe("pending");
    expect(other.checkoutId).toContain("chk_");
  });

  it("runs on-demand health with timeout and strips secrets", async () => {
    const leaky = gatewayPlugin(PAY_ID, {
      healthMessage: "ok whsec_live_secret",
    });
    const slow = gatewayPlugin(PAY_ID, { healthDelayMs: 200 });
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: PAY_ID,
      type: "gateway",
      version: "1.0.0",
      manifest: payManifest,
      enabled: true,
      status: "started",
    });
    await persist.createInstance({
      id: INSTANCE_A,
      pluginId: PAY_ID,
      kind: "gateway",
      displayName: "Primary",
      enabled: true,
    });

    const leakyRegistry = createGatewayRegistry({
      persist,
      getGatewayPlugin: () => leaky,
      isPluginActive: () => true,
      createContext: (pluginId, instanceId) =>
        fakeContext(pluginId, instanceId),
    });
    const leakyResult = await leakyRegistry.health(INSTANCE_A);
    expect(leakyResult.status).toBe("ok");
    expect(leakyResult.message).toBeUndefined();
    expect(JSON.stringify(leakyResult)).not.toContain("whsec_");
    expect(leakyResult.pluginId).toBe(PAY_ID);
    expect(leakyResult.instanceId).toBe(INSTANCE_A);

    const slowRegistry = createGatewayRegistry({
      persist,
      getGatewayPlugin: () => slow,
      isPluginActive: () => true,
      createContext: (pluginId, instanceId) =>
        fakeContext(pluginId, instanceId),
      healthTimeoutMs: 20,
    });
    const timedOut = await slowRegistry.health(INSTANCE_A);
    expect(timedOut.status).toBe("unhealthy");
    expect(timedOut.message).toBe("Health check timed out");
  });

  it("requires billing permissions and supports refund plus payment status", async () => {
    const { registry, persist } = await setup();
    const status = await registry.getPaymentStatus({
      instanceId: INSTANCE_A,
      checkoutId: "chk_done",
    });
    expect(status).toBe("completed");
    const refund = await registry.refund({
      instanceId: INSTANCE_A,
      checkoutId: "chk_1",
      amount: { amount: 500, currency: "USD" },
    });
    expect(refund.status).toBe("refunded");
    expect(refund.amount).toEqual({ amount: 500, currency: "USD" });

    await persist.upsertInstall({
      id: PAY_ID,
      type: "gateway",
      version: "1.0.0",
      manifest: { ...payManifest, permissions: [] },
      enabled: true,
      status: "started",
    });
    await expect(
      registry.createCheckout(checkoutRequest(INSTANCE_A)),
    ).rejects.toBeInstanceOf(ForgePermissionError);
  });

  it("replays successful checkouts from plugin KV and does not poison on failure", async () => {
    let attempts = 0;
    const plugin: FluxoGatewayPlugin = {
      ...gatewayPlugin(PAY_ID),
      async createCheckout(_ctx, request) {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("psp down");
        }
        return {
          mode: "redirect",
          checkoutId: `chk_${attempts}_${request.instanceId.slice(0, 8)}`,
          redirectUrl: `https://psp.example/pay/${attempts}`,
          status: "pending",
        };
      },
    };
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: PAY_ID,
      type: "gateway",
      version: "1.0.0",
      manifest: payManifest,
      enabled: true,
      status: "started",
    });
    await persist.createInstance({
      id: INSTANCE_A,
      pluginId: PAY_ID,
      kind: "gateway",
      displayName: "Primary",
      enabled: true,
    });

    const registry = createGatewayRegistry({
      persist,
      getGatewayPlugin: () => plugin,
      isPluginActive: () => true,
      createContext: (pluginId, instanceId) =>
        fakeContext(pluginId, instanceId),
    });

    await expect(
      registry.createCheckout(checkoutRequest(INSTANCE_A)),
    ).rejects.toMatchObject({ code: "forge_gateway" });
    expect(attempts).toBe(1);

    const first = await registry.createCheckout(checkoutRequest(INSTANCE_A));
    expect(first.checkoutId).toBe(`chk_2_${INSTANCE_A.slice(0, 8)}`);
    expect(attempts).toBe(2);

    const replay = await registry.createCheckout(checkoutRequest(INSTANCE_A));
    expect(replay).toEqual(first);
    expect(attempts).toBe(2);

    await expect(
      registry.createCheckout({
        ...checkoutRequest(INSTANCE_A),
        amount: { amount: 5000, currency: "USD" },
      }),
    ).rejects.toBeInstanceOf(ForgeValidationError);
    await expect(
      registry.createCheckout({
        ...checkoutRequest(INSTANCE_A),
        amount: { amount: 1999, currency: "EUR" },
      }),
    ).rejects.toBeInstanceOf(ForgeValidationError);
    expect(attempts).toBe(2);

    const restarted = createGatewayRegistry({
      persist,
      getGatewayPlugin: () => plugin,
      isPluginActive: () => true,
      createContext: (pluginId, instanceId) =>
        fakeContext(pluginId, instanceId),
    });
    const afterRestart = await restarted.createCheckout(
      checkoutRequest(INSTANCE_A),
    );
    expect(afterRestart).toEqual(first);
    expect(attempts).toBe(2);

    const keys = await persist.listKvKeys(
      PAY_ID,
      `forge/gateway/${INSTANCE_A}/checkout/idemp/`,
    );
    expect(keys).toHaveLength(1);
  });

  it("emits payment.refunded after a successful refund", async () => {
    const bus = createForgeEventBus();
    const refunded = vi.fn();
    const completed = vi.fn();
    bus.on("payment.refunded", refunded);
    bus.on("payment.completed", completed);
    setActiveForgeEventBus(bus);
    const { registry } = await setup();
    const checkout = await registry.createCheckout(checkoutRequest(INSTANCE_A));
    expect(completed).not.toHaveBeenCalled();
    const refund = await registry.refund({
      instanceId: INSTANCE_A,
      checkoutId: checkout.checkoutId,
      amount: { amount: 500, currency: "USD" },
    });
    expect(refund.status).toBe("refunded");
    expect(refunded).toHaveBeenCalledWith({
      paymentId: checkout.checkoutId,
      invoiceId: "inv_1",
      amount: { amount: 500, currency: "USD" },
    });
  });

  it("emits payment.completed when checkout or status is completed", async () => {
    const bus = createForgeEventBus();
    const completed = vi.fn();
    const failed = vi.fn();
    bus.on("payment.completed", completed);
    bus.on("payment.failed", failed);
    setActiveForgeEventBus(bus);
    const plugin = gatewayPlugin(PAY_ID);
    plugin.createCheckout = async (_ctx, request) => ({
      mode: "offline",
      checkoutId: `chk_${request.idempotencyKey}_done`,
      status: "completed",
    });
    plugin.getPaymentStatus = async () => "completed";
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: PAY_ID,
      type: "gateway",
      version: "1.0.0",
      manifest: payManifest,
      enabled: true,
      status: "started",
    });
    await persist.createInstance({
      id: INSTANCE_A,
      pluginId: PAY_ID,
      kind: "gateway",
      displayName: "Primary",
      enabled: true,
    });
    const registry = createGatewayRegistry({
      persist,
      getGatewayPlugin: () => plugin,
      isPluginActive: () => true,
      createContext: (pluginId, instanceId) =>
        fakeContext(pluginId, instanceId),
    });

    const checkout = await registry.createCheckout(checkoutRequest(INSTANCE_A));
    expect(checkout.status).toBe("completed");
    expect(completed).toHaveBeenCalledWith({
      paymentId: checkout.checkoutId,
      invoiceId: "inv_1",
      amount: { amount: 1999, currency: "USD" },
    });
    expect(failed).not.toHaveBeenCalled();

    completed.mockClear();
    const status = await registry.getPaymentStatus({
      instanceId: INSTANCE_A,
      checkoutId: checkout.checkoutId,
    });
    expect(status).toBe("completed");
    expect(completed).toHaveBeenCalledWith({
      paymentId: checkout.checkoutId,
      invoiceId: "inv_1",
      amount: { amount: 1999, currency: "USD" },
    });
  });

  it("does not emit payment events when checkout throws", async () => {
    const bus = createForgeEventBus();
    const completed = vi.fn();
    bus.on("payment.completed", completed);
    setActiveForgeEventBus(bus);
    const { registry } = await setup({
      plugins: new Map([
        [PAY_ID, gatewayPlugin(PAY_ID, { throwOn: "createCheckout" })],
      ]),
    });
    await expect(
      registry.createCheckout(checkoutRequest(INSTANCE_A)),
    ).rejects.toMatchObject({ code: "forge_gateway" });
    expect(completed).not.toHaveBeenCalled();
  });

  it("emits payment.completed from handleWebhook when status is completed", async () => {
    const bus = createForgeEventBus();
    const completed = vi.fn();
    bus.on("payment.completed", completed);
    setActiveForgeEventBus(bus);
    const plugin = gatewayPlugin(PAY_ID);
    plugin.handleWebhook = async (_ctx, request) => ({
      status: 200,
      recognized: true,
      payment: {
        checkoutId: `chk_${request.instanceId.slice(0, 8)}`,
        status: "completed",
      },
    });
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: PAY_ID,
      type: "gateway",
      version: "1.0.0",
      manifest: payManifest,
      enabled: true,
      status: "started",
    });
    await persist.createInstance({
      id: INSTANCE_A,
      pluginId: PAY_ID,
      kind: "gateway",
      displayName: "Primary",
      enabled: true,
    });
    const registry = createGatewayRegistry({
      persist,
      getGatewayPlugin: () => plugin,
      isPluginActive: () => true,
      createContext: (pluginId, instanceId) =>
        fakeContext(pluginId, instanceId),
    });
    const checkout = await registry.createCheckout(checkoutRequest(INSTANCE_A));
    completed.mockClear();
    await registry.handleWebhook(PAY_ID, {
      method: "POST",
      headers: {},
      query: {},
      rawBody: new Uint8Array(),
      instanceId: INSTANCE_A,
    });
    expect(completed).toHaveBeenCalledWith({
      paymentId: checkout.checkoutId,
      invoiceId: "inv_1",
      amount: { amount: 1999, currency: "USD" },
    });
  });

  it("does not fail refund when a payment event listener throws", async () => {
    const bus = createForgeEventBus();
    bus.on("payment.refunded", () => {
      throw new Error("listener boom");
    });
    setActiveForgeEventBus(bus);
    const { registry } = await setup();
    const checkout = await registry.createCheckout(checkoutRequest(INSTANCE_A));
    await expect(
      registry.refund({
        instanceId: INSTANCE_A,
        checkoutId: checkout.checkoutId,
        amount: { amount: 500, currency: "USD" },
      }),
    ).resolves.toMatchObject({ status: "refunded" });
  });
});

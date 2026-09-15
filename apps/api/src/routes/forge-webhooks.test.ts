import {
  FORGE_WEBHOOK_PATH_PREFIX,
  forgeWebhookPath,
  type FluxoGatewayPlugin,
  type PluginContext,
  type PluginLogger,
  type PluginManifest,
  type PluginWebhookRequest,
  type PluginWebhookResult,
} from "@fluxo/forge";
import type { FluxoLogger } from "@fluxo/logger";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { createMemoryPluginPersist } from "../forge/persist.js";
import {
  FORGE_WEBHOOK_MAX_BODY_BYTES,
  forgeWebhookRoutes,
} from "./forge-webhooks.js";

const PAY_ID = "acme.pay";
const INSTANCE_A = "11111111-1111-4111-8111-111111111111";
const INSTANCE_B = "22222222-2222-4222-8222-222222222222";

const payManifest: PluginManifest = {
  id: PAY_ID,
  name: "Pay",
  version: "1.0.0",
  type: "gateway",
  forgeApi: "^0.1.0",
  entry: "index.js",
  permissions: ["billing.checkout", "billing.webhook", "webhooks.receive"],
};

function fakeLogger(): FluxoLogger & PluginLogger {
  const logger: FluxoLogger & PluginLogger = {
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

function gatewayPlugin(options?: {
  throwOnWebhook?: boolean;
  handlers?: readonly string[];
  capture?: { request?: PluginWebhookRequest };
}): FluxoGatewayPlugin {
  const plugin: FluxoGatewayPlugin & {
    webhookHandlers: () => readonly string[];
  } = {
    manifest: payManifest,
    webhookHandlers: () => options?.handlers ?? ["notify"],
    async createCheckout() {
      return {
        mode: "token",
        checkoutId: "chk_1",
        clientToken: "tok_client",
        status: "pending",
      };
    },
    async getPaymentStatus() {
      return "pending";
    },
    async handleWebhook(
      _ctx: PluginContext,
      request: PluginWebhookRequest,
    ): Promise<PluginWebhookResult> {
      if (options?.capture) {
        options.capture.request = request;
      }
      if (options?.throwOnWebhook) {
        throw new Error("sk_live_webhook_secret payload=4111111111111111");
      }
      return {
        status: 200,
        recognized: true,
        body: { ok: true },
        payment: { checkoutId: "chk_1", status: "completed" },
      };
    },
  };
  return plugin;
}

async function setup(options?: {
  active?: boolean;
  plugin?: FluxoGatewayPlugin | undefined;
  handlers?: readonly string[];
  throwOnWebhook?: boolean;
  capture?: { request?: PluginWebhookRequest };
  logger?: FluxoLogger;
  install?: boolean;
  enabled?: boolean;
}) {
  const persist = createMemoryPluginPersist();
  if (options?.install !== false) {
    await persist.upsertInstall({
      id: PAY_ID,
      type: "gateway",
      version: "1.0.0",
      manifest: payManifest,
      enabled: options?.enabled ?? true,
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
  }
  const logger = options?.logger ?? fakeLogger();
  const plugin =
    options?.plugin === undefined
      ? gatewayPlugin({
          throwOnWebhook: options?.throwOnWebhook,
          handlers: options?.handlers,
          capture: options?.capture,
        })
      : options.plugin;
  const app = new Hono();
  app.route(
    FORGE_WEBHOOK_PATH_PREFIX,
    forgeWebhookRoutes({
      persist,
      getGatewayPlugin: () => plugin,
      isPluginActive: () => options?.active ?? true,
      createContext: (pluginId, instanceId) => fakeContext(pluginId, instanceId),
      logger,
    }),
  );
  return { app, persist, logger, plugin };
}

describe("forgeWebhookRoutes", () => {
  it("rejects path traversal in pluginId", async () => {
    const { app } = await setup();
    const attempts = [
      `${FORGE_WEBHOOK_PATH_PREFIX}/../etc/passwd/${INSTANCE_A}/notify`,
      `${FORGE_WEBHOOK_PATH_PREFIX}/..%2fetc/${INSTANCE_A}/notify`,
      `${FORGE_WEBHOOK_PATH_PREFIX}/foo/../bar/${INSTANCE_A}/notify`,
      `${FORGE_WEBHOOK_PATH_PREFIX}/acme.pay%2f..%2fx/${INSTANCE_A}/notify`,
      `${FORGE_WEBHOOK_PATH_PREFIX}/__proto__/${INSTANCE_A}/notify`,
      `${FORGE_WEBHOOK_PATH_PREFIX}/%2e%2e/${INSTANCE_A}/notify`,
    ];
    for (const path of attempts) {
      const response = await app.request(path, { method: "POST", body: "{}" });
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).not.toBe(200);
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        stack?: string;
      };
      expect(JSON.stringify(body)).not.toContain("passwd");
      expect(body.stack).toBeUndefined();
    }
  });

  it("returns 404 for an unknown plugin", async () => {
    const { app } = await setup({ install: false });
    const path = forgeWebhookPath("missing.pay", INSTANCE_A, "notify");
    const response = await app.request(path, { method: "POST", body: "{}" });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Not found: webhook",
      code: "forge_not_found",
    });
  });

  it("returns 404 for a disabled or inactive plugin", async () => {
    const disabled = await setup({ enabled: false });
    const inactive = await setup({ active: false });
    const path = forgeWebhookPath(PAY_ID, INSTANCE_A, "notify");
    const disabledResponse = await disabled.app.request(path, {
      method: "POST",
      body: "{}",
    });
    const inactiveResponse = await inactive.app.request(path, {
      method: "POST",
      body: "{}",
    });
    expect(disabledResponse.status).toBe(404);
    expect(inactiveResponse.status).toBe(404);
    expect(await disabledResponse.json()).toEqual({
      error: "Not found: webhook",
      code: "forge_not_found",
    });
  });

  it("only dispatches namespaced registered handlers", async () => {
    const capture: { request?: PluginWebhookRequest } = {};
    const { app } = await setup({ handlers: ["notify"], capture });
    const allowed = forgeWebhookPath(PAY_ID, INSTANCE_A, "notify");
    const denied = forgeWebhookPath(PAY_ID, INSTANCE_A, "other");
    const ok = await app.request(allowed, {
      method: "POST",
      headers: { "content-type": "application/json", "x-psp-signature": "sig_abc" },
      body: JSON.stringify({ event: "paid" }),
    });
    const blocked = await app.request(denied, {
      method: "POST",
      body: JSON.stringify({ event: "paid" }),
    });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    expect(blocked.status).toBe(404);
    expect(capture.request?.instanceId).toBe(INSTANCE_A);
    expect(capture.request?.rawBody).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(capture.request?.rawBody)).toBe(
      JSON.stringify({ event: "paid" }),
    );
    expect(capture.request?.headers["x-psp-signature"]).toBe("sig_abc");
    expect(capture.request?.headers["x-request-id"]).toEqual(expect.any(String));

    const otherInstance = await app.request(
      forgeWebhookPath(PAY_ID, INSTANCE_B, "notify"),
      { method: "POST", body: "{}" },
    );
    expect(otherInstance.status).toBe(200);
    expect(capture.request?.instanceId).toBe(INSTANCE_B);
  });

  it("does not log the raw webhook body or secrets", async () => {
    const logger = fakeLogger();
    const { app } = await setup({ logger });
    const secretBody = JSON.stringify({
      cardNumber: "4111111111111111",
      cvc: "123",
      secret: "sk_live_abc",
    });
    const response = await app.request(forgeWebhookPath(PAY_ID, INSTANCE_A, "notify"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer sk_live_abc",
      },
      body: secretBody,
    });
    expect(response.status).toBe(200);
    const logged = JSON.stringify([
      vi.mocked(logger.debug).mock.calls,
      vi.mocked(logger.info).mock.calls,
      vi.mocked(logger.warn).mock.calls,
      vi.mocked(logger.error).mock.calls,
    ]);
    expect(logged).not.toContain("4111111111111111");
    expect(logged).not.toContain("sk_live_abc");
    expect(logged).not.toContain(secretBody);
    expect(logged).not.toContain("Bearer sk_live");
    expect(logged).toContain("forge webhook");
    expect(logged).toContain(PAY_ID);
  });

  it("isolates plugin throws as a Forge 500 without stack or secrets", async () => {
    const logger = fakeLogger();
    const { app } = await setup({ throwOnWebhook: true, logger });
    const response = await app.request(forgeWebhookPath(PAY_ID, INSTANCE_A, "notify"), {
      method: "POST",
      body: JSON.stringify({ pan: "4111111111111111" }),
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as {
      error: string;
      code: string;
      stack?: string;
    };
    expect(body).toEqual({ error: "Webhook handling failed", code: "forge_webhook" });
    expect(body.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("sk_live");
    expect(JSON.stringify(body)).not.toContain("4111111111111111");
    const logged = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(logged).not.toContain("sk_live_webhook_secret");
    expect(logged).not.toContain("4111111111111111");
  });

  it("rejects oversized bodies", async () => {
    const { app } = await setup();
    const oversized = "x".repeat(FORGE_WEBHOOK_MAX_BODY_BYTES + 1);
    const response = await app.request(forgeWebhookPath(PAY_ID, INSTANCE_A, "notify"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(oversized.length),
      },
      body: oversized,
    });
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({
      error: "Webhook payload too large",
      code: "forge_payload_too_large",
    });
  });

  it("assigns a request id", async () => {
    const { app } = await setup();
    const response = await app.request(forgeWebhookPath(PAY_ID, INSTANCE_A, "notify"), {
      method: "POST",
      body: "{}",
    });
    expect(response.headers.get("x-request-id")).toEqual(expect.any(String));
    expect(response.headers.get("x-request-id")?.length).toBeGreaterThan(0);
  });
});

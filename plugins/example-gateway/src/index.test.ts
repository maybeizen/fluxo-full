import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ForgeNotFoundError,
  parsePluginManifest,
  type CreateCheckoutRequest,
  type PluginContext,
  type PluginLogger,
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

function fakeContext(
  instanceId: string,
  secret: string | undefined = "shared-secret",
): PluginContext {
  return {
    pluginId: "example-gateway",
    instanceId,
    logger: fakeLogger(),
    config: {
      get: (key) =>
        key === "sandbox"
          ? true
          : key === "url"
            ? "https://example.invalid"
            : undefined,
      getSecret: (key) => (key === "secret" ? secret : undefined),
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

function checkoutRequest(
  instanceId: string,
  idempotencyKey = "idem-1",
): CreateCheckoutRequest {
  return {
    idempotencyKey,
    instanceId,
    invoiceId: "inv-1",
    amount: { amount: 1999, currency: "USD" },
    customer: { userId: "user-1", email: "ada@example.com" },
    returnUrl: "https://app.example/return",
    cancelUrl: "https://app.example/cancel",
  };
}

describe("example-gateway", () => {
  it("matches plugin.json and does not expose card APIs", () => {
    expect(plugin.manifest).toEqual(PLUGIN_JSON);
    expect(plugin.manifest.type).toBe("gateway");
    expect(SOURCE).not.toMatch(
      /@fluxo\/db|prisma|theme-system|PaymentIntent|cardNumber|cvc/,
    );
    expect(plugin).not.toHaveProperty("chargeCard");
    expect(plugin).not.toHaveProperty("createPaymentIntent");
    expect(typeof plugin.createCheckout).toBe("function");
    expect(typeof plugin.getPaymentStatus).toBe("function");
    expect(typeof plugin.refund).toBe("function");
    expect(typeof plugin.handleWebhook).toBe("function");
  });

  it("creates checkouts, replays idempotency keys, and refunds", async () => {
    const ctx = fakeContext("inst-a");
    const first = await plugin.createCheckout(ctx, checkoutRequest("inst-a"));
    expect(first.mode).toBe("redirect");
    expect(first.status).toBe("pending");
    expect(first.checkoutId).toContain("inst-a");
    expect(first.redirectUrl).toContain(first.checkoutId);
    expect(first).not.toHaveProperty("cardNumber");
    expect(first).not.toHaveProperty("cvc");

    const replay = await plugin.createCheckout(ctx, checkoutRequest("inst-a"));
    expect(replay.checkoutId).toBe(first.checkoutId);

    await expect(
      plugin.getPaymentStatus(ctx, {
        instanceId: "inst-a",
        checkoutId: first.checkoutId,
      }),
    ).resolves.toBe("pending");

    const refunded = await plugin.refund?.(ctx, {
      instanceId: "inst-a",
      checkoutId: first.checkoutId,
    });
    expect(refunded?.status).toBe("refunded");
    expect(refunded?.amount).toEqual({ amount: 1999, currency: "USD" });
    await expect(
      plugin.getPaymentStatus(ctx, {
        instanceId: "inst-a",
        checkoutId: first.checkoutId,
      }),
    ).resolves.toBe("refunded");
  });

  it("keeps two instances isolated and verifies webhook secrets", async () => {
    const east = fakeContext("east");
    const west = fakeContext("west");
    const eastCheckout = await plugin.createCheckout(
      east,
      checkoutRequest("east"),
    );
    const westCheckout = await plugin.createCheckout(
      west,
      checkoutRequest("west"),
    );
    expect(eastCheckout.checkoutId).not.toBe(westCheckout.checkoutId);

    await expect(
      plugin.getPaymentStatus(west, {
        instanceId: "west",
        checkoutId: eastCheckout.checkoutId,
      }),
    ).rejects.toBeInstanceOf(ForgeNotFoundError);

    const rejected = await plugin.handleWebhook?.(east, {
      method: "POST",
      headers: { "x-webhook-secret": "wrong" },
      query: {},
      rawBody: new TextEncoder().encode(
        JSON.stringify({
          checkoutId: eastCheckout.checkoutId,
          status: "completed",
        }),
      ),
      instanceId: "east",
    });
    expect(rejected?.recognized).toBe(false);
    expect(rejected?.status).toBe(401);

    const accepted = await plugin.handleWebhook?.(east, {
      method: "POST",
      headers: { "x-webhook-secret": "shared-secret" },
      query: {},
      rawBody: new TextEncoder().encode(
        JSON.stringify({
          checkoutId: eastCheckout.checkoutId,
          status: "completed",
        }),
      ),
      instanceId: "east",
    });
    expect(accepted).toMatchObject({
      status: 200,
      recognized: true,
      payment: { checkoutId: eastCheckout.checkoutId, status: "completed" },
    });
    await expect(
      plugin.getPaymentStatus(east, {
        instanceId: "east",
        checkoutId: eastCheckout.checkoutId,
      }),
    ).resolves.toBe("completed");
    await expect(
      plugin.getPaymentStatus(west, {
        instanceId: "west",
        checkoutId: westCheckout.checkoutId,
      }),
    ).resolves.toBe("pending");
  });
});

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ForgeNotFoundError,
  ForgeValidationError,
  parsePluginManifest,
  type CreateCheckoutRequest,
  type JsonValue,
  type PluginContext,
  type PluginLogger,
} from "@fluxo/forge";
import { describe, expect, it } from "vitest";
import plugin, { WEBHOOK_SIGNATURE_HEADER } from "./index.js";

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

function memoryStorage(): PluginContext["storage"] {
  const values = new Map<string, JsonValue>();
  return {
    get: async (key) => values.get(key),
    set: async (key, value) => {
      values.set(key, value);
    },
    delete: async (key) => {
      values.delete(key);
    },
    keys: async (prefix) =>
      [...values.keys()].filter((key) =>
        prefix === undefined ? true : key.startsWith(prefix),
      ),
  };
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
    storage: memoryStorage(),
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
  amount = { amount: 1999, currency: "USD" },
): CreateCheckoutRequest {
  return {
    idempotencyKey,
    instanceId,
    invoiceId: "inv-1",
    amount,
    customer: { userId: "user-1", email: "ada@example.com" },
    returnUrl: "https://app.example/return",
    cancelUrl: "https://app.example/cancel",
  };
}

function signBody(secret: string, body: Uint8Array): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

async function notify(
  ctx: PluginContext,
  checkoutId: string,
  status: string,
  options?: { eventId?: string; secret?: string; tamper?: boolean },
) {
  const payload = JSON.stringify({
    ...(options?.eventId === undefined ? {} : { eventId: options.eventId }),
    checkoutId,
    status,
  });
  const rawBody = new TextEncoder().encode(payload);
  const signed = options?.tamper
    ? new TextEncoder().encode(`${payload} `)
    : rawBody;
  const secret = options?.secret ?? "shared-secret";
  return plugin.handleWebhook?.(ctx, {
    method: "POST",
    headers: {
      [WEBHOOK_SIGNATURE_HEADER]: signBody(secret, signed),
    },
    query: {},
    rawBody,
    instanceId: ctx.instanceId ?? "missing",
  });
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

  it("rejects checkout replay when the amount or currency does not match", async () => {
    const ctx = fakeContext("amount-bind");
    const first = await plugin.createCheckout(
      ctx,
      checkoutRequest("amount-bind"),
    );
    const same = await plugin.createCheckout(
      ctx,
      checkoutRequest("amount-bind"),
    );
    expect(same.checkoutId).toBe(first.checkoutId);

    await expect(
      plugin.createCheckout(
        ctx,
        checkoutRequest("amount-bind", "idem-1", {
          amount: 5000,
          currency: "USD",
        }),
      ),
    ).rejects.toBeInstanceOf(ForgeValidationError);

    await expect(
      plugin.createCheckout(
        ctx,
        checkoutRequest("amount-bind", "idem-1", {
          amount: 1999,
          currency: "EUR",
        }),
      ),
    ).rejects.toBeInstanceOf(ForgeValidationError);

    await expect(
      plugin.createCheckout(
        ctx,
        checkoutRequest("amount-bind", "idem-1", {
          amount: 1999,
          currency: "USD",
        }),
      ),
    ).resolves.toMatchObject({ checkoutId: first.checkoutId });
  });

  it("keeps two instances isolated and verifies webhook HMAC of the raw body", async () => {
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
      headers: { [WEBHOOK_SIGNATURE_HEADER]: "sha256=deadbeef" },
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

    const missing = await plugin.handleWebhook?.(east, {
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
    expect(missing?.status).toBe(401);
    expect(missing?.recognized).toBe(false);

    const tampered = await notify(east, eastCheckout.checkoutId, "completed", {
      tamper: true,
    });
    expect(tampered?.status).toBe(401);
    expect(tampered?.recognized).toBe(false);

    const accepted = await notify(east, eastCheckout.checkoutId, "completed", {
      eventId: "evt-complete",
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

  it("treats webhook retries as idempotent and keeps completed from moving to failed", async () => {
    const ctx = fakeContext("mono");
    const checkout = await plugin.createCheckout(ctx, checkoutRequest("mono"));

    const first = await notify(ctx, checkout.checkoutId, "completed", {
      eventId: "evt-1",
    });
    expect(first?.payment?.status).toBe("completed");

    const replay = await notify(ctx, checkout.checkoutId, "completed", {
      eventId: "evt-1",
    });
    expect(replay).toMatchObject({
      status: 200,
      recognized: true,
      body: { ok: true, replay: true },
      payment: { checkoutId: checkout.checkoutId, status: "completed" },
    });

    const demote = await notify(ctx, checkout.checkoutId, "failed", {
      eventId: "evt-2",
    });
    expect(demote?.status).toBe(200);
    expect(demote?.payment?.status).toBe("completed");
    await expect(
      plugin.getPaymentStatus(ctx, {
        instanceId: "mono",
        checkoutId: checkout.checkoutId,
      }),
    ).resolves.toBe("completed");

    const pending = await notify(ctx, checkout.checkoutId, "pending", {
      eventId: "evt-3",
    });
    expect(pending?.payment?.status).toBe("completed");

    const refunded = await notify(ctx, checkout.checkoutId, "refunded", {
      eventId: "evt-4",
    });
    expect(refunded?.payment?.status).toBe("refunded");
    await expect(
      plugin.getPaymentStatus(ctx, {
        instanceId: "mono",
        checkoutId: checkout.checkoutId,
      }),
    ).resolves.toBe("refunded");

    const afterRefund = await notify(ctx, checkout.checkoutId, "failed", {
      eventId: "evt-5",
    });
    expect(afterRefund?.payment?.status).toBe("refunded");
  });
});

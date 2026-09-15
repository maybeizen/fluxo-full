import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  FluxoGatewayPlugin,
  ForgeNotFoundError,
  ForgeValidationError,
  defineGatewayPlugin,
  parsePluginManifest,
  type CheckoutResult,
  type CreateCheckoutRequest,
  type PaymentStatus,
  type PaymentStatusRequest,
  type PluginContext,
  type PluginHealthResult,
  type PluginWebhookRequest,
  type PluginWebhookResult,
  type RefundRequest,
  type RefundResult,
} from "@fluxo/forge";

const MANIFEST = parsePluginManifest({
  id: "example-gateway",
  name: "Example Gateway",
  version: "1.0.0",
  type: "gateway",
  forgeApi: "^0.1.0",
  entry: "src/index.ts",
  description: "In-process example payment gateway used for Forge tests.",
  author: "Fluxo",
  config: [
    {
      key: "url",
      label: "Gateway URL",
      type: "url",
      required: true,
      default: "https://example.invalid",
    },
    {
      key: "secret",
      label: "Webhook secret",
      type: "secret",
      required: true,
    },
    {
      key: "sandbox",
      label: "Sandbox mode",
      type: "boolean",
      default: true,
    },
  ],
  permissions: [
    "config.read",
    "billing.checkout",
    "billing.refund",
    "billing.webhook",
    "webhooks.receive",
  ],
});

const PAYMENT_STATUSES = new Set<PaymentStatus>([
  "pending",
  "processing",
  "completed",
  "failed",
  "canceled",
  "refunded",
]);

export const WEBHOOK_SIGNATURE_HEADER = "x-webhook-signature";

interface PaymentRecord {
  checkoutId: string;
  instanceId: string;
  invoiceId: string;
  amount: { amount: number; currency: string };
  status: PaymentStatus;
  refundId?: string;
  refundedAmount?: { amount: number; currency: string };
}

interface CheckoutIdempotencyRecord {
  checkoutId: string;
  amount: { amount: number; currency: string };
}

function checkoutStoreKey(instanceId: string, checkoutId: string): string {
  return `${instanceId}:${checkoutId}`;
}

function idempotencyKey(instanceId: string, key: string): string {
  return `${instanceId}:${key}`;
}

function webhookEventKey(instanceId: string, eventId: string): string {
  const digest = createHash("sha256").update(eventId).digest("hex");
  return `${instanceId}/webhook-events/${digest}`;
}

function headerValue(
  headers: Readonly<Record<string, string>>,
  name: string,
): string | undefined {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) {
      return value;
    }
  }
  return undefined;
}

function parseSignature(value: string): string | undefined {
  const trimmed = value.trim();
  const prefixed = /^sha256=([0-9a-fA-F]+)$/.exec(trimmed);
  if (prefixed?.[1] !== undefined) {
    return prefixed[1].toLowerCase();
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  return undefined;
}

function hmacHex(secret: string, body: Uint8Array): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function signaturesEqual(expectedHex: string, providedHex: string): boolean {
  const expected = Buffer.from(expectedHex, "utf8");
  const provided = Buffer.from(providedHex, "utf8");
  if (expected.length !== provided.length) {
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(expected, provided);
}

function verifyWebhookSignature(
  secret: string | undefined,
  headers: Readonly<Record<string, string>>,
  rawBody: Uint8Array,
): boolean {
  if (secret === undefined || secret.length === 0) {
    return false;
  }
  const provided = headerValue(headers, WEBHOOK_SIGNATURE_HEADER);
  if (provided === undefined) {
    return false;
  }
  const providedHex = parseSignature(provided);
  if (providedHex === undefined) {
    return false;
  }
  return signaturesEqual(hmacHex(secret, rawBody), providedHex);
}

function amountsMatch(
  stored: { amount: number; currency: string },
  requested: { amount: number; currency: string },
): boolean {
  return (
    stored.amount === requested.amount && stored.currency === requested.currency
  );
}

function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  if (from === to) {
    return true;
  }
  if (from === "refunded") {
    return false;
  }
  if (from === "completed") {
    return to === "refunded";
  }
  return true;
}

function eventIdFrom(
  body: Record<string, unknown>,
  rawBody: Uint8Array,
): string {
  if (typeof body.eventId === "string" && body.eventId.length > 0) {
    return body.eventId;
  }
  return createHash("sha256").update(rawBody).digest("hex");
}

class ExampleGatewayPlugin extends FluxoGatewayPlugin {
  override readonly manifest = MANIFEST;
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly checkoutsByIdempotency = new Map<
    string,
    CheckoutIdempotencyRecord
  >();
  private sequence = 0;

  webhookHandlers(): readonly string[] {
    return ["notify"];
  }

  override async createCheckout(
    _ctx: PluginContext,
    request: CreateCheckoutRequest,
  ): Promise<CheckoutResult> {
    const key = idempotencyKey(request.instanceId, request.idempotencyKey);
    const replay = this.checkoutsByIdempotency.get(key);
    if (replay !== undefined) {
      if (!amountsMatch(replay.amount, request.amount)) {
        throw new ForgeValidationError(
          "Checkout idempotency key reused with a different amount",
        );
      }
      const stored = this.payments.get(
        checkoutStoreKey(request.instanceId, replay.checkoutId),
      );
      if (stored) {
        return this.toCheckoutResult(stored, request.returnUrl);
      }
    }

    this.sequence += 1;
    const checkoutId = `chk_${request.instanceId}_${this.sequence}`;
    const record: PaymentRecord = {
      checkoutId,
      instanceId: request.instanceId,
      invoiceId: request.invoiceId,
      amount: {
        amount: request.amount.amount,
        currency: request.amount.currency,
      },
      status: "pending",
    };
    this.payments.set(checkoutStoreKey(request.instanceId, checkoutId), record);
    this.checkoutsByIdempotency.set(key, {
      checkoutId,
      amount: {
        amount: request.amount.amount,
        currency: request.amount.currency,
      },
    });
    return this.toCheckoutResult(record, request.returnUrl);
  }

  override async getPaymentStatus(
    _ctx: PluginContext,
    request: PaymentStatusRequest,
  ): Promise<PaymentStatus> {
    const record = this.payments.get(
      checkoutStoreKey(request.instanceId, request.checkoutId),
    );
    if (record === undefined) {
      throw new ForgeNotFoundError(`checkout ${request.checkoutId}`);
    }
    return record.status;
  }

  override async refund(
    _ctx: PluginContext,
    request: RefundRequest,
  ): Promise<RefundResult> {
    const record = this.payments.get(
      checkoutStoreKey(request.instanceId, request.checkoutId),
    );
    if (record === undefined) {
      throw new ForgeNotFoundError(`checkout ${request.checkoutId}`);
    }
    const amount = request.amount ?? record.amount;
    if (record.refundId !== undefined && record.refundedAmount !== undefined) {
      return {
        refundId: record.refundId,
        status: "refunded",
        amount: record.refundedAmount,
      };
    }
    record.status = "refunded";
    record.refundId = `ref_${record.checkoutId}`;
    record.refundedAmount = {
      amount: amount.amount,
      currency: amount.currency,
    };
    return {
      refundId: record.refundId,
      status: "refunded",
      amount: record.refundedAmount,
    };
  }

  override async handleWebhook(
    ctx: PluginContext,
    request: PluginWebhookRequest,
  ): Promise<PluginWebhookResult> {
    const expected = ctx.config.getSecret("secret");
    if (!verifyWebhookSignature(expected, request.headers, request.rawBody)) {
      return { status: 401, recognized: false };
    }

    let payload: unknown;
    try {
      payload = JSON.parse(
        new TextDecoder().decode(request.rawBody),
      ) as unknown;
    } catch {
      return { status: 400, recognized: true };
    }
    if (typeof payload !== "object" || payload === null) {
      return { status: 400, recognized: true };
    }
    const body = payload as Record<string, unknown>;
    const checkoutId = body.checkoutId;
    const status = body.status;
    if (typeof checkoutId !== "string" || !isPaymentStatus(status)) {
      return { status: 400, recognized: true };
    }

    const eventId = eventIdFrom(body, request.rawBody);
    const eventKey = webhookEventKey(request.instanceId, eventId);
    const seen = await ctx.storage.get(eventKey);
    if (isProcessedEvent(seen)) {
      return {
        status: 200,
        recognized: true,
        body: { ok: true, replay: true },
        payment: { checkoutId: seen.checkoutId, status: seen.status },
      };
    }

    const record = this.payments.get(
      checkoutStoreKey(request.instanceId, checkoutId),
    );
    if (record === undefined) {
      return { status: 404, recognized: true };
    }

    if (canTransition(record.status, status)) {
      record.status = status;
    }

    await ctx.storage.set(eventKey, {
      checkoutId: record.checkoutId,
      status: record.status,
    });

    return {
      status: 200,
      recognized: true,
      body: { ok: true },
      payment: { checkoutId: record.checkoutId, status: record.status },
    };
  }

  override async health(
    ctx: PluginContext,
    signal: AbortSignal,
  ): Promise<PluginHealthResult> {
    if (signal.aborted) {
      throw new Error("Health check aborted");
    }
    const sandbox = ctx.config.get("sandbox");
    return {
      status: "ok",
      message: sandbox === false ? "live" : "sandbox",
    };
  }

  private toCheckoutResult(
    record: PaymentRecord,
    returnUrl: string,
  ): CheckoutResult {
    const separator = returnUrl.includes("?") ? "&" : "?";
    return {
      mode: "redirect",
      checkoutId: record.checkoutId,
      redirectUrl: `${returnUrl}${separator}checkoutId=${encodeURIComponent(record.checkoutId)}`,
      status: record.status,
    };
  }
}

function isPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === "string" && PAYMENT_STATUSES.has(value as PaymentStatus)
  );
}

function isProcessedEvent(
  value: unknown,
): value is { checkoutId: string; status: PaymentStatus } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.checkoutId === "string" && isPaymentStatus(record.status)
  );
}

export default defineGatewayPlugin(new ExampleGatewayPlugin());

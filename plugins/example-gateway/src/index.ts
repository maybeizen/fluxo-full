import {
  FluxoGatewayPlugin,
  ForgeNotFoundError,
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

interface PaymentRecord {
  checkoutId: string;
  instanceId: string;
  invoiceId: string;
  amount: { amount: number; currency: string };
  status: PaymentStatus;
  refundId?: string;
  refundedAmount?: { amount: number; currency: string };
}

function checkoutStoreKey(instanceId: string, checkoutId: string): string {
  return `${instanceId}:${checkoutId}`;
}

function idempotencyKey(instanceId: string, key: string): string {
  return `${instanceId}:${key}`;
}

class ExampleGatewayPlugin extends FluxoGatewayPlugin {
  override readonly manifest = MANIFEST;
  private readonly payments = new Map<string, PaymentRecord>();
  private readonly checkoutsByIdempotency = new Map<string, string>();
  private sequence = 0;

  webhookHandlers(): readonly string[] {
    return ["notify"];
  }

  override async createCheckout(
    _ctx: PluginContext,
    request: CreateCheckoutRequest,
  ): Promise<CheckoutResult> {
    const replay = this.checkoutsByIdempotency.get(
      idempotencyKey(request.instanceId, request.idempotencyKey),
    );
    if (replay !== undefined) {
      const stored = this.payments.get(
        checkoutStoreKey(request.instanceId, replay),
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
    this.checkoutsByIdempotency.set(
      idempotencyKey(request.instanceId, request.idempotencyKey),
      checkoutId,
    );
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
    const provided =
      request.headers["x-webhook-secret"] ??
      request.headers["X-Webhook-Secret"];
    if (expected === undefined || provided !== expected) {
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
    const record = this.payments.get(
      checkoutStoreKey(request.instanceId, checkoutId),
    );
    if (record === undefined) {
      return { status: 404, recognized: true };
    }
    record.status = status;
    return {
      status: 200,
      recognized: true,
      body: { ok: true },
      payment: { checkoutId, status },
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

export default defineGatewayPlugin(new ExampleGatewayPlugin());

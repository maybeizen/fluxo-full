import type { PluginContext } from "./context.js";
import type { PluginId } from "./identity.js";
import type { Money } from "./money.js";
import { FluxoPlugin } from "./plugin.js";

export type CheckoutMode = "redirect" | "token" | "offline";

export type PaymentStatus =
  "pending" | "processing" | "completed" | "failed" | "canceled" | "refunded";

export interface CheckoutCustomer {
  userId: string;
  email: string;
}

export interface CreateCheckoutRequest {
  idempotencyKey: string;
  instanceId: string;
  invoiceId: string;
  amount: Money;
  customer: CheckoutCustomer;
  returnUrl: string;
  cancelUrl: string;
  metadata?: Readonly<Record<string, string>>;
}

export interface CheckoutResult {
  mode: CheckoutMode;
  checkoutId: string;
  redirectUrl?: string;
  clientToken?: string;
  status: PaymentStatus;
}

export interface PaymentStatusRequest {
  instanceId: string;
  checkoutId: string;
}

export interface RefundRequest {
  instanceId: string;
  checkoutId: string;
  amount?: Money;
  reason?: string;
}

export interface RefundResult {
  refundId: string;
  status: PaymentStatus;
  amount: Money;
}

export type PluginWebhookMethod = "GET" | "POST" | "PUT";

export interface PluginWebhookRequest {
  method: PluginWebhookMethod;
  headers: Readonly<Record<string, string>>;
  query: Readonly<Record<string, string>>;
  rawBody: Uint8Array;
  instanceId: string;
}

export interface PluginWebhookResult {
  status: number;
  body?: unknown;
  recognized: boolean;
  payment?: {
    checkoutId: string;
    status: PaymentStatus;
  };
}

export interface GatewayInstance {
  id: string;
  pluginId: PluginId;
  displayName: string;
  enabled: boolean;
}

export interface ResolvedGatewayProvider {
  instance: GatewayInstance;
  pluginId: PluginId;
}

export interface GatewayRegistry {
  listInstances(pluginId?: PluginId): Promise<readonly GatewayInstance[]>;
  getInstance(instanceId: string): Promise<GatewayInstance | null>;
  resolve(instanceId: string): Promise<ResolvedGatewayProvider>;
}

export abstract class FluxoGatewayPlugin extends FluxoPlugin {
  abstract createCheckout(
    ctx: PluginContext,
    request: CreateCheckoutRequest,
  ): Promise<CheckoutResult>;
  abstract getPaymentStatus(
    ctx: PluginContext,
    request: PaymentStatusRequest,
  ): Promise<PaymentStatus>;
  refund?(ctx: PluginContext, request: RefundRequest): Promise<RefundResult>;
  handleWebhook?(
    ctx: PluginContext,
    request: PluginWebhookRequest,
  ): Promise<PluginWebhookResult>;
  webhookHandlers?(): readonly string[];
}

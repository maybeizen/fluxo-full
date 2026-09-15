import {
  FORGE_HEALTH_TIMEOUT_MS,
  ForgeError,
  ForgeNotFoundError,
  ForgePermissionError,
  ForgeTimeoutError,
  ForgeValidationError,
  isSafeWebhookName,
  parseInstanceId,
  parsePluginId,
  parseWebhookName,
  type CheckoutResult,
  type CreateCheckoutRequest,
  type FluxoGatewayPlugin,
  type GatewayInstance,
  type GatewayRegistry,
  type PluginContext,
  type PluginHealthSnapshot,
  type PluginId,
  type PluginPermission,
  type PaymentStatus,
  type PaymentStatusRequest,
  type PluginWebhookRequest,
  type PluginWebhookResult,
  type RefundRequest,
  type RefundResult,
  type ResolvedGatewayProvider,
} from "@fluxo/forge";
import type {
  PluginInstallRow,
  PluginInstanceRow,
  PluginPersist,
} from "./persist.js";

export class GatewayNotFoundError extends ForgeNotFoundError {
  constructor(resource: string) {
    super(resource);
  }
}

export class GatewayPluginDisabledError extends ForgeError {
  readonly pluginId: string;

  constructor(pluginId: string) {
    super(
      "forge_gateway_disabled",
      `Gateway plugin ${pluginId} is disabled`,
      409,
    );
    this.pluginId = pluginId;
  }
}

export class GatewayInstanceDisabledError extends ForgeError {
  readonly instanceId: string;

  constructor(instanceId: string) {
    super(
      "forge_gateway_disabled",
      `Gateway instance ${instanceId} is disabled`,
      409,
    );
    this.instanceId = instanceId;
  }
}

export class GatewayWrongTypeError extends ForgeValidationError {
  readonly instanceId: string;

  constructor(instanceId: string) {
    super(`Instance ${instanceId} is not a gateway`);
    this.instanceId = instanceId;
  }
}

export interface GatewayRegistryDeps {
  persist: PluginPersist;
  getGatewayPlugin(pluginId: string): FluxoGatewayPlugin | undefined;
  isPluginActive(pluginId: string): boolean;
  createContext?(
    pluginId: string,
    instanceId?: string,
  ): PluginContext | Promise<PluginContext>;
  healthTimeoutMs?: number;
}

export interface FluxoGatewayRegistry extends GatewayRegistry {
  createCheckout(request: CreateCheckoutRequest): Promise<CheckoutResult>;
  getPaymentStatus(request: PaymentStatusRequest): Promise<PaymentStatus>;
  refund(request: RefundRequest): Promise<RefundResult>;
  health(instanceId: string): Promise<PluginHealthSnapshot>;
  handleWebhook(
    pluginId: string,
    request: PluginWebhookRequest,
  ): Promise<PluginWebhookResult>;
  listWebhookHandlers(pluginId: string): Promise<readonly string[]>;
  registerWebhookHandlers(pluginId: string, names: readonly string[]): void;
}

type GatewayPluginWithHandlers = FluxoGatewayPlugin & {
  webhookHandlers?: () => readonly string[];
};

const SECRETISH =
  /sk_live|sk_test|whsec_|password|secret|api[_-]?key|bearer\s|-----BEGIN|"iv"\s*:/i;
const CARDISH_KEY = /card|cvc|cvv|pan|credit.?card/i;

export function createGatewayRegistry(
  deps: GatewayRegistryDeps,
): FluxoGatewayRegistry {
  const persist = deps.persist;
  const healthTimeoutMs = deps.healthTimeoutMs ?? FORGE_HEALTH_TIMEOUT_MS;
  const registeredHandlers = new Map<string, Set<string>>();

  async function requireGatewayInstance(instanceId: string): Promise<{
    instance: GatewayInstance;
    pluginId: PluginId;
    plugin: FluxoGatewayPlugin;
    install: PluginInstallRow;
  }> {
    const id = parseInstanceId(instanceId);
    const row = await persist.getInstance(id);
    if (row === undefined) {
      throw new GatewayNotFoundError(`gateway instance ${id}`);
    }
    if (row.kind !== "gateway") {
      throw new GatewayWrongTypeError(id);
    }
    const install = await persist.getInstall(row.pluginId);
    if (install === undefined) {
      throw new GatewayNotFoundError(`plugin ${row.pluginId}`);
    }
    if (install.type !== "gateway") {
      throw new GatewayWrongTypeError(id);
    }
    if (install.status === "error") {
      throw new GatewayPluginDisabledError(row.pluginId);
    }
    if (!install.enabled || !deps.isPluginActive(row.pluginId)) {
      throw new GatewayPluginDisabledError(row.pluginId);
    }
    if (!row.enabled) {
      throw new GatewayInstanceDisabledError(id);
    }
    const plugin = deps.getGatewayPlugin(row.pluginId);
    if (plugin === undefined) {
      throw new GatewayPluginDisabledError(row.pluginId);
    }
    return {
      instance: toGatewayInstance(row),
      pluginId: row.pluginId,
      plugin,
      install,
    };
  }

  async function invoke<T>(
    ctx: PluginContext,
    operation: string,
    run: () => Promise<T>,
  ): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof ForgeError) {
        throw error;
      }
      ctx.logger.error("gateway plugin threw", {
        operation,
        pluginId: ctx.pluginId,
        instanceId: ctx.instanceId,
        errorName: error instanceof Error ? error.name : "unknown",
      });
      throw new ForgeError("forge_gateway", `${operation} failed`, 500);
    }
  }

  async function contextFor(
    pluginId: string,
    instanceId: string,
  ): Promise<PluginContext> {
    if (deps.createContext === undefined) {
      throw new ForgeError(
        "forge_plugin_failed",
        "Plugin context is not configured",
        500,
      );
    }
    const ctx = await deps.createContext(pluginId, instanceId);
    if (ctx.pluginId === pluginId && ctx.instanceId === instanceId) {
      return ctx;
    }
    return { ...ctx, pluginId, instanceId };
  }

  return {
    async listInstances(pluginId) {
      const id = pluginId === undefined ? undefined : parsePluginId(pluginId);
      const rows = await persist.listInstances(id);
      return rows
        .filter((row) => row.kind === "gateway")
        .map(toGatewayInstance);
    },

    async getInstance(instanceId) {
      const id = parseInstanceId(instanceId);
      const row = await persist.getInstance(id);
      if (row === undefined || row.kind !== "gateway") {
        return null;
      }
      return toGatewayInstance(row);
    },

    async resolve(instanceId) {
      const resolved = await requireGatewayInstance(instanceId);
      const provider: ResolvedGatewayProvider = {
        instance: resolved.instance,
        pluginId: resolved.pluginId,
      };
      return provider;
    },

    async createCheckout(request) {
      assertNoCardFields(request);
      const resolved = await requireGatewayInstance(request.instanceId);
      assertPermission(resolved.install, "billing.checkout");
      const ctx = await contextFor(resolved.pluginId, resolved.instance.id);
      return invoke(ctx, "createCheckout", () =>
        resolved.plugin.createCheckout(ctx, request),
      );
    },

    async getPaymentStatus(request) {
      const resolved = await requireGatewayInstance(request.instanceId);
      assertPermission(resolved.install, "billing.checkout");
      const ctx = await contextFor(resolved.pluginId, resolved.instance.id);
      return invoke(ctx, "getPaymentStatus", () =>
        resolved.plugin.getPaymentStatus(ctx, request),
      );
    },

    async refund(request) {
      const resolved = await requireGatewayInstance(request.instanceId);
      assertPermission(resolved.install, "billing.refund");
      const refund = resolved.plugin.refund;
      if (refund === undefined) {
        throw new ForgeValidationError("Gateway does not support refunds");
      }
      const ctx = await contextFor(resolved.pluginId, resolved.instance.id);
      return invoke(ctx, "refund", () =>
        refund.call(resolved.plugin, ctx, request),
      );
    },

    async health(instanceId) {
      const resolved = await requireGatewayInstance(instanceId);
      const ctx = await contextFor(resolved.pluginId, resolved.instance.id);
      return runHealth(
        ctx,
        resolved.plugin,
        resolved.instance.id,
        healthTimeoutMs,
      );
    },

    async handleWebhook(pluginId, request) {
      const id = parsePluginId(pluginId);
      const install = await persist.getInstall(id);
      if (install === undefined) {
        throw new GatewayNotFoundError(`plugin ${id}`);
      }
      if (
        install.type !== "gateway" ||
        !install.enabled ||
        !deps.isPluginActive(id)
      ) {
        throw new GatewayPluginDisabledError(id);
      }
      const plugin = deps.getGatewayPlugin(id);
      const handleWebhook = plugin?.handleWebhook;
      if (plugin === undefined || handleWebhook === undefined) {
        throw new GatewayNotFoundError(`plugin ${id}`);
      }
      if (!hasWebhookPermission(install)) {
        throw new ForgePermissionError("webhooks.receive");
      }
      const instance = await persist.getInstance(
        parseInstanceId(request.instanceId),
      );
      if (
        instance === undefined ||
        instance.pluginId !== id ||
        instance.kind !== "gateway" ||
        !instance.enabled
      ) {
        throw new GatewayNotFoundError(
          `gateway instance ${request.instanceId}`,
        );
      }
      const ctx = await contextFor(id, instance.id);
      return invoke(ctx, "handleWebhook", () =>
        handleWebhook.call(plugin, ctx, request),
      );
    },

    async listWebhookHandlers(pluginId) {
      const id = parsePluginId(pluginId);
      const names = new Set<string>(registeredHandlers.get(id) ?? []);
      const plugin = deps.getGatewayPlugin(id);
      if (plugin !== undefined) {
        for (const name of listDeclaredWebhookHandlers(plugin)) {
          names.add(name);
        }
      }
      return [...names];
    },

    registerWebhookHandlers(pluginId, names) {
      const id = parsePluginId(pluginId);
      const existing = registeredHandlers.get(id) ?? new Set<string>();
      for (const name of names) {
        existing.add(parseWebhookName(name));
      }
      registeredHandlers.set(id, existing);
    },
  };
}

export function listDeclaredWebhookHandlers(
  plugin: FluxoGatewayPlugin,
): readonly string[] {
  const declared = (plugin as GatewayPluginWithHandlers).webhookHandlers;
  if (typeof declared !== "function") {
    return [];
  }
  let names: unknown;
  try {
    names = declared.call(plugin);
  } catch {
    return [];
  }
  if (!Array.isArray(names)) {
    return [];
  }
  const result: string[] = [];
  for (const name of names) {
    if (typeof name === "string" && isSafeWebhookName(name)) {
      result.push(name);
    }
  }
  return result;
}

export function gatewayRegistryMethodNames(): readonly string[] {
  return [
    "listInstances",
    "getInstance",
    "resolve",
    "createCheckout",
    "getPaymentStatus",
    "refund",
    "health",
    "handleWebhook",
    "listWebhookHandlers",
    "registerWebhookHandlers",
  ];
}

export function assertNoCardFields(value: object): void {
  for (const key of Object.keys(value)) {
    if (CARDISH_KEY.test(key)) {
      throw new ForgeValidationError("Card data is not accepted");
    }
  }
}

function toGatewayInstance(row: PluginInstanceRow): GatewayInstance {
  return {
    id: row.id,
    pluginId: row.pluginId,
    displayName: row.displayName,
    enabled: row.enabled,
  };
}

function assertPermission(
  install: PluginInstallRow,
  permission: PluginPermission,
): void {
  if (!manifestHasPermission(install, permission)) {
    throw new ForgePermissionError(permission);
  }
}

function hasWebhookPermission(install: PluginInstallRow): boolean {
  return (
    manifestHasPermission(install, "webhooks.receive") ||
    manifestHasPermission(install, "billing.webhook")
  );
}

function manifestHasPermission(
  install: PluginInstallRow,
  permission: PluginPermission,
): boolean {
  const manifest = install.manifest;
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    return false;
  }
  const permissions = (manifest as { permissions?: unknown }).permissions;
  return Array.isArray(permissions) && permissions.includes(permission);
}

function sanitizeHealthMessage(
  message: string | undefined,
): string | undefined {
  if (message === undefined || message.length === 0) {
    return undefined;
  }
  if (SECRETISH.test(message)) {
    return undefined;
  }
  return message.length > 200 ? message.slice(0, 200) : message;
}

async function runHealth(
  ctx: PluginContext,
  plugin: FluxoGatewayPlugin,
  instanceId: string,
  timeoutMs: number,
): Promise<PluginHealthSnapshot> {
  const started = performance.now();
  const snapshot = {
    pluginId: ctx.pluginId,
    instanceId,
    checkedAt: new Date().toISOString(),
  };
  const latency = () => Math.round(performance.now() - started);
  if (plugin.health === undefined) {
    return { status: "ok", ...snapshot, latencyMs: latency() };
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Promise.resolve(plugin.health(ctx, controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new ForgeTimeoutError());
        }, timeoutMs);
      }),
    ]);
    const status =
      result.status === "ok" ||
      result.status === "degraded" ||
      result.status === "unhealthy"
        ? result.status
        : "unhealthy";
    const message = sanitizeHealthMessage(result.message);
    return {
      status,
      ...(message === undefined ? {} : { message }),
      ...snapshot,
      latencyMs: latency(),
    };
  } catch (error) {
    const timedOut =
      error instanceof ForgeTimeoutError || controller.signal.aborted;
    ctx.logger.error("gateway health failed", {
      pluginId: ctx.pluginId,
      instanceId,
      errorName: error instanceof Error ? error.name : "unknown",
      timedOut,
    });
    return {
      status: "unhealthy",
      message: timedOut ? "Health check timed out" : "Health check failed",
      ...snapshot,
      latencyMs: latency(),
    };
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

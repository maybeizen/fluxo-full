import { createHash, randomUUID } from "node:crypto";
import {
  FORGE_HEALTH_TIMEOUT_MS,
  ForgeConflictError,
  ForgeError,
  ForgeNotFoundError,
  ForgeTimeoutError,
  ForgeValidationError,
  REDACTED,
  SERVICE_CAPABILITIES,
  assertNoPrototypePollution,
  isSafeStorageKey,
  jsonValueSchema,
  parseInstanceId,
  parsePluginId,
  type FluxoServicePlugin,
  type JsonValue,
  type PluginContext,
  type PluginHealthSnapshot,
  type PluginId,
  type PowerRequest,
  type PowerResult,
  type ProvisionAction,
  type ProvisionRequest,
  type ProvisionResult,
  type ReconcileRequest,
  type ResolvedServiceProvider,
  type ServiceCapability,
  type ServiceInstance,
  type ServiceRegistry,
} from "@fluxo/forge";
import type { PluginPersist, PluginInstanceRow } from "./persist.js";

const CAPABILITY_SET = new Set<string>(SERVICE_CAPABILITIES);
const ACTION_CAPABILITY = {
  create: "provision.create",
  suspend: "provision.suspend",
  unsuspend: "provision.unsuspend",
  terminate: "provision.terminate",
  modify: "provision.modify",
  reconcile: "provision.reconcile",
} as const satisfies Record<ProvisionAction, ServiceCapability>;
const POWER_CAPABILITY = {
  start: "power.start",
  stop: "power.stop",
  restart: "power.restart",
} as const satisfies Record<PowerRequest["action"], ServiceCapability>;
const SENSITIVE_MESSAGE =
  /password|secret|token|authorization|ciphertext|api[_-]?key|bearer\s|encryptedpayload/i;

export interface ServiceRegistryDeps {
  persist: PluginPersist;
  getServicePlugin(pluginId: string): FluxoServicePlugin | undefined;
  isPluginActive(pluginId: string): boolean;
  createContext?(
    pluginId: string,
    instanceId: string,
  ): PluginContext | Promise<PluginContext>;
  healthTimeoutMs?: number;
}

export interface HostProvisionResult extends ProvisionResult {
  operationId: string;
}

export interface BoundServiceProvider extends ResolvedServiceProvider {
  supports(capability: ServiceCapability): boolean;
  capabilities(): readonly ServiceCapability[];
  provisioningVariables(): ReturnType<
    FluxoServicePlugin["provisioningVariables"]
  >;
  provisionService(
    input: Omit<ProvisionRequest, "instanceId" | "action">,
  ): Promise<HostProvisionResult>;
  suspend(
    input: Omit<ProvisionRequest, "instanceId" | "action">,
  ): Promise<HostProvisionResult>;
  unsuspend(
    input: Omit<ProvisionRequest, "instanceId" | "action">,
  ): Promise<HostProvisionResult>;
  terminate(
    input: Omit<ProvisionRequest, "instanceId" | "action">,
  ): Promise<HostProvisionResult>;
  getService(
    input: Omit<ReconcileRequest, "instanceId">,
  ): Promise<HostProvisionResult>;
  power(input: Omit<PowerRequest, "instanceId">): Promise<PowerResult>;
  health(): Promise<PluginHealthSnapshot>;
}

export interface HostServiceRegistry extends ServiceRegistry {
  resolve(instanceId: string): Promise<BoundServiceProvider>;
}

interface StoredOperation {
  action: ProvisionAction;
  idempotencyKey: string;
  operationId: string;
  remoteId?: string;
  status: ProvisionResult["status"];
  message?: string;
  runtime?: Record<string, JsonValue>;
}

interface StoredServiceState {
  remoteId?: string;
  status: ProvisionResult["status"];
  operationId?: string;
  runtime?: Record<string, JsonValue>;
}

export function createServiceRegistry(
  deps: ServiceRegistryDeps,
): HostServiceRegistry {
  const persist = deps.persist;
  const healthTimeoutMs = deps.healthTimeoutMs ?? FORGE_HEALTH_TIMEOUT_MS;

  async function listInstances(
    pluginId?: PluginId,
  ): Promise<readonly ServiceInstance[]> {
    const rows = await persist.listInstances(
      pluginId === undefined ? undefined : parsePluginId(pluginId),
    );
    return rows.filter((row) => row.kind === "service").map(toServiceInstance);
  }

  async function getInstance(
    instanceId: string,
  ): Promise<ServiceInstance | null> {
    const id = parseInstanceId(instanceId);
    const row = await persist.getInstance(id);
    if (row === undefined || row.kind !== "service") {
      return null;
    }
    return toServiceInstance(row);
  }

  async function resolve(instanceId: string): Promise<BoundServiceProvider> {
    const id = parseInstanceId(instanceId);
    const row = await persist.getInstance(id);
    if (row === undefined) {
      throw new ForgeNotFoundError(`plugin instance ${id}`);
    }
    if (row.kind !== "service") {
      throw new ForgeValidationError("Instance is not a service provider");
    }

    const install = await persist.getInstall(row.pluginId);
    if (install === undefined) {
      throw new ForgeNotFoundError(`plugin ${row.pluginId}`);
    }
    if (install.type !== "service") {
      throw new ForgeValidationError("Plugin is not a service plugin");
    }
    if (install.status === "error") {
      throw pluginFailedError();
    }
    if (!row.enabled) {
      throw new ForgeConflictError("Service instance is disabled");
    }
    if (!install.enabled || !deps.isPluginActive(row.pluginId)) {
      throw new ForgeConflictError("Service plugin is disabled");
    }

    const plugin = deps.getServicePlugin(row.pluginId);
    if (!isServicePlugin(plugin)) {
      throw pluginFailedError();
    }

    const advertised = readCapabilities(plugin);
    const instance = toServiceInstance(row);

    const runProvision = (
      action: ProvisionAction,
      input: Omit<ProvisionRequest, "instanceId" | "action">,
    ): Promise<HostProvisionResult> =>
      provisionWithPlugin(plugin, instance, advertised, action, input);

    const provider: BoundServiceProvider = {
      instance,
      pluginId: instance.pluginId,
      supports(capability) {
        return advertised.includes(capability);
      },
      capabilities() {
        return advertised;
      },
      provisioningVariables() {
        try {
          const fields = plugin.provisioningVariables();
          return Array.isArray(fields) ? fields : [];
        } catch (error) {
          mapPluginError(error, "Service plugin operation failed");
        }
      },
      provisionService(input) {
        return runProvision("create", input);
      },
      suspend(input) {
        return runProvision("suspend", input);
      },
      unsuspend(input) {
        return runProvision("unsuspend", input);
      },
      terminate(input) {
        return runProvision("terminate", input);
      },
      getService(input) {
        return getServiceWithPlugin(plugin, instance, advertised, input);
      },
      power(input) {
        return powerWithPlugin(plugin, instance, advertised, input);
      },
      health() {
        return checkHealth(plugin, instance);
      },
    };
    return provider;
  }

  async function contextFor(
    pluginId: string,
    instanceId: string,
  ): Promise<PluginContext> {
    if (!deps.createContext) {
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

  async function provisionWithPlugin(
    plugin: FluxoServicePlugin,
    instance: ServiceInstance,
    advertised: readonly ServiceCapability[],
    action: ProvisionAction,
    input: Omit<ProvisionRequest, "instanceId" | "action">,
  ): Promise<HostProvisionResult> {
    assertCapability(advertised, ACTION_CAPABILITY[action]);
    const request = bindProvisionRequest(instance.id, action, input);
    const replay = await loadIdempotentResult(instance, request);
    if (replay) {
      return replay;
    }

    const ctx = await contextFor(instance.pluginId, instance.id);
    let raw: ProvisionResult;
    try {
      raw = await plugin.provision(ctx, request);
    } catch (error) {
      mapPluginError(error, "Service plugin operation failed");
    }

    const result = toHostProvisionResult(raw, randomUUID());
    if (result.status !== "failed") {
      await persistProvision(instance, request, result);
    }
    return result;
  }

  async function getServiceWithPlugin(
    plugin: FluxoServicePlugin,
    instance: ServiceInstance,
    advertised: readonly ServiceCapability[],
    input: Omit<ReconcileRequest, "instanceId">,
  ): Promise<HostProvisionResult> {
    const stored = await loadServiceState(
      instance.pluginId,
      instance.id,
      input.serviceId,
    );
    const remoteId = input.remoteId ?? stored?.remoteId;
    if (plugin.reconcile && advertised.includes("provision.reconcile")) {
      const ctx = await contextFor(instance.pluginId, instance.id);
      const request: ReconcileRequest = {
        instanceId: instance.id,
        serviceId: input.serviceId,
        ...(remoteId === undefined ? {} : { remoteId }),
      };
      let raw: ProvisionResult;
      try {
        raw = await plugin.reconcile(ctx, request);
      } catch (error) {
        mapPluginError(error, "Service plugin operation failed");
      }
      const result = toHostProvisionResult(
        raw,
        stored?.operationId ?? randomUUID(),
      );
      if (result.status !== "failed") {
        await persistServiceState(
          instance.pluginId,
          instance.id,
          input.serviceId,
          {
            remoteId: result.remoteId ?? remoteId,
            status: result.status,
            operationId: result.operationId,
            runtime: asRuntime(result.runtime),
          },
        );
      }
      return result;
    }
    if (stored === undefined && remoteId === undefined) {
      throw new ForgeNotFoundError(`service ${input.serviceId}`);
    }
    return {
      status: stored?.status ?? "ok",
      operationId: stored?.operationId ?? randomUUID(),
      ...(remoteId === undefined ? {} : { remoteId }),
      ...(stored?.runtime === undefined ? {} : { runtime: stored.runtime }),
    };
  }

  async function powerWithPlugin(
    plugin: FluxoServicePlugin,
    instance: ServiceInstance,
    advertised: readonly ServiceCapability[],
    input: Omit<PowerRequest, "instanceId">,
  ): Promise<PowerResult> {
    assertCapability(advertised, POWER_CAPABILITY[input.action]);
    if (typeof plugin.power !== "function") {
      throw new ForgeValidationError("Service capability not supported: power");
    }
    const ctx = await contextFor(instance.pluginId, instance.id);
    const request: PowerRequest = {
      ...input,
      instanceId: instance.id,
    };
    try {
      const raw = await plugin.power(ctx, request);
      return {
        status: raw.status,
        ...(sanitizeMessage(raw.message) === undefined
          ? {}
          : { message: sanitizeMessage(raw.message) }),
      };
    } catch (error) {
      mapPluginError(error, "Service plugin operation failed");
    }
  }

  async function checkHealth(
    plugin: FluxoServicePlugin,
    instance: ServiceInstance,
  ): Promise<PluginHealthSnapshot> {
    const checkedAt = new Date().toISOString();
    const started = Date.now();
    if (typeof plugin.health !== "function") {
      return {
        status: "ok",
        pluginId: instance.pluginId,
        instanceId: instance.id,
        checkedAt,
        latencyMs: Date.now() - started,
      };
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ForgeTimeoutError("Service health check timed out"));
      }, healthTimeoutMs);
    });

    try {
      const ctx = await contextFor(instance.pluginId, instance.id);
      const raw = await Promise.race([
        plugin.health(ctx, controller.signal),
        timeout,
      ]);
      const message = sanitizeMessage(raw.message);
      return {
        status: raw.status,
        pluginId: instance.pluginId,
        instanceId: instance.id,
        checkedAt,
        latencyMs: Date.now() - started,
        ...(message === undefined ? {} : { message }),
      };
    } catch (error) {
      if (error instanceof ForgeTimeoutError || controller.signal.aborted) {
        throw new ForgeTimeoutError("Service health check timed out");
      }
      mapPluginError(error, "Service health check failed");
      throw error;
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  async function loadIdempotentResult(
    instance: ServiceInstance,
    request: ProvisionRequest,
  ): Promise<HostProvisionResult | undefined> {
    const stored = await persist.getKv(
      instance.pluginId,
      idempotencyKey(
        instance.id,
        request.serviceId,
        request.action,
        request.idempotencyKey,
      ),
    );
    const record = parseStoredOperation(stored);
    if (record === undefined) {
      return undefined;
    }
    return {
      status: record.status,
      operationId: record.operationId,
      idempotentReplay: true,
      ...(record.remoteId === undefined ? {} : { remoteId: record.remoteId }),
      ...(record.message === undefined ? {} : { message: record.message }),
      ...(record.runtime === undefined ? {} : { runtime: record.runtime }),
    };
  }

  async function persistProvision(
    instance: ServiceInstance,
    request: ProvisionRequest,
    result: HostProvisionResult,
  ): Promise<void> {
    const runtime = asRuntime(result.runtime);
    const operation: StoredOperation = {
      action: request.action,
      idempotencyKey: request.idempotencyKey,
      operationId: result.operationId,
      status: result.status,
      ...(result.remoteId === undefined ? {} : { remoteId: result.remoteId }),
      ...(result.message === undefined ? {} : { message: result.message }),
      ...(runtime === undefined ? {} : { runtime }),
    };
    await persist.setKv(
      instance.pluginId,
      idempotencyKey(
        instance.id,
        request.serviceId,
        request.action,
        request.idempotencyKey,
      ),
      operationRecord(operation),
    );
    await persistServiceState(
      instance.pluginId,
      instance.id,
      request.serviceId,
      {
        remoteId: result.remoteId,
        status: result.status,
        operationId: result.operationId,
        runtime,
      },
    );
  }

  async function persistServiceState(
    pluginId: string,
    instanceId: string,
    serviceId: string,
    state: StoredServiceState,
  ): Promise<void> {
    await persist.setKv(pluginId, serviceStateKey(instanceId, serviceId), {
      ...(state.remoteId === undefined ? {} : { remoteId: state.remoteId }),
      status: state.status,
      ...(state.operationId === undefined
        ? {}
        : { operationId: state.operationId }),
      ...(state.runtime === undefined ? {} : { runtime: state.runtime }),
    });
  }

  async function loadServiceState(
    pluginId: string,
    instanceId: string,
    serviceId: string,
  ): Promise<StoredServiceState | undefined> {
    const stored = await persist.getKv(
      pluginId,
      serviceStateKey(instanceId, serviceId),
    );
    return parseStoredState(stored);
  }

  return {
    listInstances,
    getInstance,
    resolve,
  };
}

function toServiceInstance(row: PluginInstanceRow): ServiceInstance {
  return {
    id: row.id,
    pluginId: row.pluginId,
    displayName: row.displayName,
    enabled: row.enabled,
  };
}

function isServicePlugin(
  value: FluxoServicePlugin | undefined,
): value is FluxoServicePlugin {
  return (
    value !== undefined &&
    typeof value.capabilities === "function" &&
    typeof value.provisioningVariables === "function" &&
    typeof value.provision === "function"
  );
}

function readCapabilities(
  plugin: FluxoServicePlugin,
): readonly ServiceCapability[] {
  let raw: readonly string[];
  try {
    raw = plugin.capabilities();
  } catch (error) {
    mapPluginError(error, "Service plugin failed");
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<ServiceCapability>();
  const advertised: ServiceCapability[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !CAPABILITY_SET.has(item)) {
      continue;
    }
    const capability = item as ServiceCapability;
    if (seen.has(capability)) {
      continue;
    }
    seen.add(capability);
    advertised.push(capability);
  }
  return advertised;
}

function assertCapability(
  advertised: readonly ServiceCapability[],
  capability: ServiceCapability,
): void {
  if (!advertised.includes(capability)) {
    throw new ForgeValidationError(
      `Service capability not supported: ${capability}`,
    );
  }
}

function bindProvisionRequest(
  instanceId: string,
  action: ProvisionAction,
  input: Omit<ProvisionRequest, "instanceId" | "action">,
): ProvisionRequest {
  const request: ProvisionRequest = {
    idempotencyKey: input.idempotencyKey,
    instanceId,
    serviceId: input.serviceId,
    userId: input.userId,
    action,
    variables: input.variables,
  };
  if (input.plan !== undefined) {
    request.plan = input.plan;
  }
  return request;
}

function toHostProvisionResult(
  raw: ProvisionResult,
  fallbackOperationId: string,
): HostProvisionResult {
  const operationId = readOperationId(raw.runtime) ?? fallbackOperationId;
  const message = sanitizeMessage(raw.message);
  const runtime = asRuntime(raw.runtime);
  return {
    status: raw.status,
    operationId,
    ...(raw.remoteId === undefined ? {} : { remoteId: raw.remoteId }),
    ...(raw.idempotentReplay === undefined
      ? {}
      : { idempotentReplay: raw.idempotentReplay }),
    ...(message === undefined ? {} : { message }),
    ...(runtime === undefined ? {} : { runtime }),
  };
}

function readOperationId(
  runtime: ProvisionResult["runtime"],
): string | undefined {
  if (runtime === undefined || typeof runtime.operationId !== "string") {
    return undefined;
  }
  if (runtime.operationId.length === 0) {
    return undefined;
  }
  return runtime.operationId;
}

function asRuntime(
  runtime: ProvisionResult["runtime"],
): Record<string, JsonValue> | undefined {
  if (runtime === undefined) {
    return undefined;
  }
  const parsed = jsonValueSchema.safeParse(runtime);
  if (
    !parsed.success ||
    typeof parsed.data !== "object" ||
    parsed.data === null ||
    Array.isArray(parsed.data)
  ) {
    return undefined;
  }
  try {
    assertNoPrototypePollution(parsed.data);
  } catch {
    return undefined;
  }
  return parsed.data;
}

function parseStoredOperation(
  value: JsonValue | undefined,
): StoredOperation | undefined {
  if (
    value === undefined ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return undefined;
  }
  const record = value;
  if (
    typeof record.action !== "string" ||
    !(record.action in ACTION_CAPABILITY)
  ) {
    return undefined;
  }
  if (
    typeof record.idempotencyKey !== "string" ||
    typeof record.operationId !== "string"
  ) {
    return undefined;
  }
  if (
    record.status !== "ok" &&
    record.status !== "pending" &&
    record.status !== "failed" &&
    record.status !== "noop"
  ) {
    return undefined;
  }
  const runtime = asRuntime(
    record.runtime !== undefined &&
      typeof record.runtime === "object" &&
      record.runtime !== null
      ? (record.runtime as Record<string, JsonValue>)
      : undefined,
  );
  return {
    action: record.action as ProvisionAction,
    idempotencyKey: record.idempotencyKey,
    operationId: record.operationId,
    status: record.status,
    ...(typeof record.remoteId === "string"
      ? { remoteId: record.remoteId }
      : {}),
    ...(typeof record.message === "string" ? { message: record.message } : {}),
    ...(runtime === undefined ? {} : { runtime }),
  };
}

function parseStoredState(
  value: JsonValue | undefined,
): StoredServiceState | undefined {
  if (
    value === undefined ||
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return undefined;
  }
  const record = value;
  if (
    record.status !== "ok" &&
    record.status !== "pending" &&
    record.status !== "failed" &&
    record.status !== "noop"
  ) {
    return undefined;
  }
  const runtime = asRuntime(
    record.runtime !== undefined &&
      typeof record.runtime === "object" &&
      record.runtime !== null
      ? (record.runtime as Record<string, JsonValue>)
      : undefined,
  );
  return {
    status: record.status,
    ...(typeof record.remoteId === "string"
      ? { remoteId: record.remoteId }
      : {}),
    ...(typeof record.operationId === "string"
      ? { operationId: record.operationId }
      : {}),
    ...(runtime === undefined ? {} : { runtime }),
  };
}

function operationRecord(operation: StoredOperation): JsonValue {
  return {
    action: operation.action,
    idempotencyKey: operation.idempotencyKey,
    operationId: operation.operationId,
    status: operation.status,
    ...(operation.remoteId === undefined
      ? {}
      : { remoteId: operation.remoteId }),
    ...(operation.message === undefined ? {} : { message: operation.message }),
    ...(operation.runtime === undefined ? {} : { runtime: operation.runtime }),
  };
}

function serviceStateKey(instanceId: string, serviceId: string): string {
  return `forge/service/${instanceId}/${storageSegment(serviceId)}/state`;
}

function idempotencyKey(
  instanceId: string,
  serviceId: string,
  action: ProvisionAction,
  key: string,
): string {
  const digest = createHash("sha256")
    .update(action)
    .update("\0")
    .update(key)
    .digest("hex");
  return `forge/service/${instanceId}/${storageSegment(serviceId)}/idemp/${digest}`;
}

function storageSegment(value: string): string {
  if (
    value.length > 0 &&
    value.length <= 80 &&
    isSafeStorageKey(value) &&
    !value.includes("/")
  ) {
    return value;
  }
  return createHash("sha256").update(value).digest("hex");
}

function sanitizeMessage(message: string | undefined): string | undefined {
  if (message === undefined || message.length === 0) {
    return undefined;
  }
  if (SENSITIVE_MESSAGE.test(message)) {
    return REDACTED;
  }
  return message;
}

function pluginFailedError(): ForgeError {
  return new ForgeError("forge_plugin_failed", "Service plugin failed", 502);
}

function mapPluginError(error: unknown, generic: string): never {
  if (error instanceof ForgeError) {
    if (SENSITIVE_MESSAGE.test(error.message)) {
      throw new ForgeError(error.code, generic, error.status);
    }
    throw error;
  }
  throw new ForgeError("forge_plugin_failed", generic, 502);
}

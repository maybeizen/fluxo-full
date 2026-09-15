import {
  FluxoServicePlugin,
  defineServicePlugin,
  parsePluginManifest,
  type JsonValue,
  type PluginContext,
  type PluginHealthResult,
  type PowerRequest,
  type PowerResult,
  type ProvisionRequest,
  type ProvisionResult,
  type ProvisioningVariableField,
  type ReconcileRequest,
  type ServiceCapability,
} from "@fluxo/forge";

const MANIFEST = parsePluginManifest({
  id: "example-service",
  name: "Example Service",
  version: "1.0.0",
  type: "service",
  forgeApi: "^0.1.0",
  entry: "src/index.ts",
  description: "In-memory example service provider used for Forge tests.",
  author: "Fluxo",
  config: [
    {
      key: "url",
      label: "Provider URL",
      type: "url",
      required: true,
      default: "https://example.invalid",
    },
    {
      key: "secret",
      label: "Provider secret",
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
    "service.provision",
    "service.suspend",
    "service.power",
  ],
});

const CAPABILITIES = [
  "provision.create",
  "provision.suspend",
  "provision.unsuspend",
  "provision.terminate",
  "provision.modify",
  "provision.reconcile",
  "power.start",
  "power.stop",
  "power.restart",
] as const satisfies readonly ServiceCapability[];

const VARIABLES: readonly ProvisioningVariableField[] = [
  {
    key: "hostname",
    label: "Hostname",
    type: "text",
    required: true,
    maxLength: 63,
    userVisible: true,
  },
  {
    key: "slots",
    label: "Slots",
    type: "number",
    integer: true,
    min: 1,
    max: 64,
    default: 1,
    userVisible: true,
  },
  {
    key: "region",
    label: "Region",
    type: "select",
    options: [
      { value: "local", label: "Local" },
      { value: "remote", label: "Remote" },
    ],
    default: "local",
    userVisible: true,
  },
];

interface ServiceRecord {
  remoteId: string;
  status: "active" | "suspended" | "terminated";
  power: "start" | "stop";
  runtime: Record<string, JsonValue>;
}

function serviceKey(instanceId: string, serviceId: string): string {
  return `${instanceId}:${serviceId}`;
}

function idempotencyKey(
  instanceId: string,
  action: string,
  key: string,
): string {
  return `${instanceId}:${action}:${key}`;
}

function cloneResult(result: ProvisionResult): ProvisionResult {
  return {
    status: result.status,
    ...(result.remoteId === undefined ? {} : { remoteId: result.remoteId }),
    ...(result.idempotentReplay === undefined
      ? {}
      : { idempotentReplay: result.idempotentReplay }),
    ...(result.message === undefined ? {} : { message: result.message }),
    ...(result.runtime === undefined ? {} : { runtime: { ...result.runtime } }),
  };
}

function runtimeOf(record: ServiceRecord): Record<string, JsonValue> {
  return {
    ...record.runtime,
    power: record.power,
    state: record.status,
  };
}

class ExampleServicePlugin extends FluxoServicePlugin {
  override readonly manifest = MANIFEST;
  private readonly services = new Map<string, ServiceRecord>();
  private readonly idempotency = new Map<string, ProvisionResult>();

  override capabilities(): readonly ServiceCapability[] {
    return CAPABILITIES;
  }

  override provisioningVariables(): readonly ProvisioningVariableField[] {
    return VARIABLES;
  }

  override async provision(
    ctx: PluginContext,
    request: ProvisionRequest,
  ): Promise<ProvisionResult> {
    void ctx;
    const replayKey = idempotencyKey(
      request.instanceId,
      request.action,
      request.idempotencyKey,
    );
    const previous = this.idempotency.get(replayKey);
    if (previous) {
      return cloneResult({ ...previous, idempotentReplay: true });
    }

    const result = this.runProvision(request);
    if (result.status !== "failed") {
      this.idempotency.set(replayKey, cloneResult(result));
    }
    return cloneResult(result);
  }

  override async reconcile(
    _ctx: PluginContext,
    request: ReconcileRequest,
  ): Promise<ProvisionResult> {
    const record = this.services.get(
      serviceKey(request.instanceId, request.serviceId),
    );
    if (record === undefined) {
      return { status: "failed", message: "Service not found" };
    }
    return {
      status: "ok",
      remoteId: record.remoteId,
      runtime: runtimeOf(record),
    };
  }

  override async power(
    _ctx: PluginContext,
    request: PowerRequest,
  ): Promise<PowerResult> {
    const target = this.services.get(
      serviceKey(request.instanceId, request.serviceId),
    );
    if (
      target === undefined ||
      target.status === "terminated" ||
      target.remoteId !== request.remoteId
    ) {
      return { status: "failed", message: "Service not found" };
    }
    if (target.status === "suspended") {
      return { status: "failed", message: "Service is suspended" };
    }
    target.power = request.action === "stop" ? "stop" : "start";
    return { status: "ok" };
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

  private runProvision(request: ProvisionRequest): ProvisionResult {
    const key = serviceKey(request.instanceId, request.serviceId);
    const existing = this.services.get(key);

    switch (request.action) {
      case "create": {
        if (existing && existing.status !== "terminated") {
          return {
            status: "ok",
            remoteId: existing.remoteId,
            runtime: runtimeOf(existing),
          };
        }
        const remoteId = `svc_${request.instanceId}_${request.serviceId}`;
        const record: ServiceRecord = {
          remoteId,
          status: "active",
          power: "start",
          runtime: {
            hostname: asString(request.variables.hostname, request.serviceId),
            slots: asNumber(request.variables.slots, 1),
            region: asString(request.variables.region, "local"),
          },
        };
        this.services.set(key, record);
        return {
          status: "ok",
          remoteId,
          runtime: runtimeOf(record),
        };
      }
      case "suspend": {
        if (existing === undefined || existing.status === "terminated") {
          return { status: "failed", message: "Service not found" };
        }
        existing.status = "suspended";
        existing.power = "stop";
        return {
          status: "ok",
          remoteId: existing.remoteId,
          runtime: runtimeOf(existing),
        };
      }
      case "unsuspend": {
        if (existing === undefined || existing.status === "terminated") {
          return { status: "failed", message: "Service not found" };
        }
        existing.status = "active";
        return {
          status: "ok",
          remoteId: existing.remoteId,
          runtime: runtimeOf(existing),
        };
      }
      case "terminate": {
        if (existing === undefined || existing.status === "terminated") {
          return { status: "noop", message: "already terminated" };
        }
        existing.status = "terminated";
        existing.power = "stop";
        this.services.delete(key);
        return {
          status: "ok",
          remoteId: existing.remoteId,
          runtime: runtimeOf(existing),
        };
      }
      case "modify": {
        if (existing === undefined || existing.status === "terminated") {
          return { status: "failed", message: "Service not found" };
        }
        if (request.variables.hostname !== undefined) {
          existing.runtime.hostname = asString(
            request.variables.hostname,
            asString(existing.runtime.hostname, request.serviceId),
          );
        }
        if (request.variables.slots !== undefined) {
          existing.runtime.slots = asNumber(
            request.variables.slots,
            asNumber(existing.runtime.slots, 1),
          );
        }
        if (request.variables.region !== undefined) {
          existing.runtime.region = asString(
            request.variables.region,
            asString(existing.runtime.region, "local"),
          );
        }
        return {
          status: "ok",
          remoteId: existing.remoteId,
          runtime: runtimeOf(existing),
        };
      }
      case "reconcile": {
        if (existing === undefined) {
          return { status: "failed", message: "Service not found" };
        }
        return {
          status: "ok",
          remoteId: existing.remoteId,
          runtime: runtimeOf(existing),
        };
      }
    }
  }
}

function asString(value: JsonValue | undefined, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asNumber(value: JsonValue | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export default defineServicePlugin(new ExampleServicePlugin());

import type { PluginConfigField } from "./config.js";
import type { PluginContext } from "./context.js";
import type { PluginId } from "./identity.js";
import type { JsonValue } from "./json.js";
import { FluxoPlugin } from "./plugin.js";

export const SERVICE_CAPABILITIES = [
  "provision.create",
  "provision.suspend",
  "provision.unsuspend",
  "provision.terminate",
  "provision.modify",
  "provision.reconcile",
  "power.start",
  "power.stop",
  "power.restart",
  "access.console",
  "access.files",
  "backup.create",
  "backup.restore",
  "usage.view",
  "network.view",
  "credential.reset",
  "reinstall",
] as const;

export type ServiceCapability = (typeof SERVICE_CAPABILITIES)[number];

export type ProvisioningVariableField = PluginConfigField & {
  userVisible?: boolean;
};

export type ProvisionAction =
  "create" | "suspend" | "unsuspend" | "terminate" | "modify" | "reconcile";

export interface ServicePlanHint {
  sku?: string;
  memoryMb?: number;
  diskMb?: number;
  cpuPercent?: number;
}

export interface ProvisionRequest {
  idempotencyKey: string;
  instanceId: string;
  serviceId: string;
  userId: string;
  action: ProvisionAction;
  variables: Readonly<Record<string, JsonValue>>;
  plan?: ServicePlanHint;
}

export type ProvisionStatus = "ok" | "pending" | "failed" | "noop";

export interface ProvisionResult {
  status: ProvisionStatus;
  remoteId?: string;
  idempotentReplay?: boolean;
  message?: string;
  runtime?: Readonly<Record<string, JsonValue>>;
}

export type PowerAction = "start" | "stop" | "restart";

export interface PowerRequest {
  instanceId: string;
  serviceId: string;
  remoteId: string;
  action: PowerAction;
}

export interface PowerResult {
  status: ProvisionStatus;
  message?: string;
}

export interface ReconcileRequest {
  instanceId: string;
  serviceId: string;
  remoteId?: string;
}

export interface ServiceInstance {
  id: string;
  pluginId: PluginId;
  displayName: string;
  enabled: boolean;
}

export interface ResolvedServiceProvider {
  instance: ServiceInstance;
  pluginId: PluginId;
}

export interface ServiceRegistry {
  listInstances(pluginId?: PluginId): Promise<readonly ServiceInstance[]>;
  getInstance(instanceId: string): Promise<ServiceInstance | null>;
  resolve(instanceId: string): Promise<ResolvedServiceProvider>;
}

export abstract class FluxoServicePlugin extends FluxoPlugin {
  abstract capabilities(): readonly ServiceCapability[];
  abstract provisioningVariables(): readonly ProvisioningVariableField[];
  abstract provision(
    ctx: PluginContext,
    request: ProvisionRequest,
  ): Promise<ProvisionResult>;
  power?(ctx: PluginContext, request: PowerRequest): Promise<PowerResult>;
  reconcile?(
    ctx: PluginContext,
    request: ReconcileRequest,
  ): Promise<ProvisionResult>;
}

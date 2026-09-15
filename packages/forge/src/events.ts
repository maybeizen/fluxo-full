import type { PluginId } from "./identity.js";
import type { JsonValue } from "./json.js";
import type { Money } from "./money.js";

export const FORGE_EVENT_NAMES = [
  "user.created",
  "user.updated",
  "user.deleted",
  "user.suspended",
  "user.unsuspended",
  "user.roleChanged",
  "session.created",
  "session.destroyed",
  "auth.login",
  "auth.logout",
  "settings.updated",
  "plugin.installed",
  "plugin.enabled",
  "plugin.disabled",
  "plugin.uninstalled",
  "service.provisioned",
  "service.suspended",
  "service.terminated",
  "payment.completed",
  "payment.failed",
  "payment.refunded",
] as const;

export type ForgeEventName = (typeof FORGE_EVENT_NAMES)[number];

export interface ForgeEventMap {
  "user.created": { userId: string };
  "user.updated": { userId: string };
  "user.deleted": { userId: string };
  "user.suspended": { userId: string; reason: string | null };
  "user.unsuspended": { userId: string };
  "user.roleChanged": { userId: string; role: "user" | "admin" };
  "session.created": { userId: string; sessionId: string };
  "session.destroyed": { userId: string; sessionId: string };
  "auth.login": { userId: string };
  "auth.logout": { userId: string };
  "settings.updated": { keys: string[] };
  "plugin.installed": { pluginId: PluginId };
  "plugin.enabled": { pluginId: PluginId };
  "plugin.disabled": { pluginId: PluginId };
  "plugin.uninstalled": { pluginId: PluginId };
  "service.provisioned": {
    serviceId: string;
    instanceId: string;
    remoteId: string;
  };
  "service.suspended": { serviceId: string; instanceId: string };
  "service.terminated": { serviceId: string; instanceId: string };
  "payment.completed": { paymentId: string; invoiceId: string; amount: Money };
  "payment.failed": { paymentId: string; invoiceId: string };
  "payment.refunded": { paymentId: string; invoiceId: string; amount: Money };
}

export type ForgeEventHandler<K extends ForgeEventName> = (
  payload: ForgeEventMap[K],
) => Promise<void> | void;

export interface PluginEvents {
  on<K extends ForgeEventName>(
    event: K,
    handler: ForgeEventHandler<K>,
  ): () => void;
  onCustom(
    name: string,
    handler: (payload: JsonValue) => Promise<void> | void,
  ): () => void;
  emitCustom(name: string, payload: JsonValue): Promise<void>;
}

export function qualifyEventName(pluginId: PluginId, name: string): string {
  return `plugin.${pluginId}.${name}`;
}

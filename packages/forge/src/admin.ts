import type { PluginConfigPublic } from "./config.js";
import type { PluginHealthResult } from "./health.js";
import type { PluginId, PluginType } from "./identity.js";
import type { PluginManifest } from "./manifest.js";
import type { PluginPermission } from "./permissions.js";

export type PluginLifecycleStatus =
  "installed" | "disabled" | "enabled" | "started" | "error";

export interface PluginDefinition {
  id: PluginId;
  type: PluginType;
  manifest: PluginManifest;
  status: PluginLifecycleStatus;
  error?: string;
}

export interface PluginDefinitionRecord {
  id: PluginId;
  type: PluginType;
  name: string;
  version: string;
  description?: string;
  author?: string;
  forgeApi: string;
  permissions: readonly PluginPermission[];
  status: PluginLifecycleStatus;
  error?: string;
  instanceCount: number;
}

export interface PluginInstanceRecord {
  id: string;
  pluginId: PluginId;
  kind: "service" | "gateway";
  displayName: string;
  enabled: boolean;
  config: PluginConfigPublic;
}

export interface PluginHealthSnapshot extends PluginHealthResult {
  pluginId: PluginId;
  instanceId?: string;
  checkedAt: string;
  latencyMs: number;
}

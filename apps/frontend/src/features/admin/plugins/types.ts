import type {
  JsonValue,
  PluginConfigField,
  PluginHealthSnapshot,
  PluginInstanceRecord,
  PluginLifecycleStatus,
  PluginPermission,
  PluginType,
} from "@fluxo/forge";

export interface AdminPluginCompatibility {
  ok: boolean;
  forgeApi: string;
  hostVersion: string;
}

export interface AdminPluginListItem {
  id: string;
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
  enabled: boolean;
  installed: boolean;
  discovered: boolean;
  compatibility: AdminPluginCompatibility;
}

export type AdminPluginDetail = AdminPluginListItem;

export interface AdminPluginConfigView {
  schema: PluginConfigField[];
  values: Record<string, JsonValue>;
  secretKeysSet: string[];
}

export interface AdminPluginListResponse {
  plugins: AdminPluginListItem[];
}

export interface AdminPluginInstancesResponse {
  instances: PluginInstanceRecord[];
}

export type PluginSecretDraft = { value: string; clear: boolean };

export type {
  JsonValue,
  PluginConfigField,
  PluginHealthSnapshot,
  PluginInstanceRecord,
};

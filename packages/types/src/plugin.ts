export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
}

export enum PluginStatus {
  Loaded = "loaded",
  Enabled = "enabled",
  Disabled = "disabled",
  Error = "error",
}

export interface PluginState {
  id: string;
  manifest: PluginManifest;
  status: PluginStatus;
  error?: string;
}

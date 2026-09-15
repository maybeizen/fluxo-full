import type { PluginDefinition, PluginLifecycleStatus } from "./admin.js";
import type { GatewayRegistry } from "./gateway.js";
import type { PluginId } from "./identity.js";
import type { PanelExtensionRegistry } from "./panel.js";
import type { ServiceRegistry } from "./service.js";

export interface PluginRegistry {
  listDefinitions(): Promise<readonly PluginDefinition[]>;
  getDefinition(id: PluginId): Promise<PluginDefinition | null>;
  install(id: PluginId): Promise<void>;
  uninstall(id: PluginId): Promise<void>;
  enable(id: PluginId): Promise<void>;
  disable(id: PluginId): Promise<void>;
}

export type { PluginLifecycleStatus };

export interface ForgeRegistries {
  plugins: PluginRegistry;
  services: ServiceRegistry;
  gateways: GatewayRegistry;
  panel: PanelExtensionRegistry;
}

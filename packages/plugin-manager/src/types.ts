import type {
  FluxoPlugin,
  PluginContext,
  PluginDefinition,
  PluginId,
  PluginLogger,
  PluginRegistry,
} from "@fluxo/forge";

export interface PluginInstallState {
  enabled: boolean;
  installed: boolean;
}

export type PluginContextFactory = (
  pluginId: PluginId,
) => PluginContext | Promise<PluginContext>;

export type PluginInstallStateGetter = (
  pluginId: PluginId,
) => PluginInstallState | Promise<PluginInstallState>;

export type PluginInstallStateSetter = (
  pluginId: PluginId,
  state: PluginInstallState,
) => void | Promise<void>;

export interface PluginManagerOptions {
  directory: string;
  logger: PluginLogger;
  createContext: PluginContextFactory;
  getInstallState?: PluginInstallStateGetter;
  setInstallState?: PluginInstallStateSetter;
}

export interface PluginLoadResult {
  id: string;
  ok: boolean;
  error?: string;
  definition?: PluginDefinition;
}

export interface PluginManager extends PluginRegistry {
  loadAll(): Promise<readonly PluginLoadResult[]>;
  stopAll(): Promise<void>;
  refresh(id?: PluginId): Promise<void>;
  list(): readonly PluginDefinition[];
  listActive(): readonly PluginDefinition[];
  getActive(id: PluginId): FluxoPlugin | undefined;
}

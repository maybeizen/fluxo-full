import type { FluxoLogger } from "@fluxo/logger";
import type { PluginState } from "@fluxo/types";

export interface PluginManagerOptions {
  directory: string;
  logger: FluxoLogger;
  config?: Readonly<Record<string, unknown>>;
}

export interface PluginLoadResult {
  id: string;
  ok: boolean;
  error?: string;
  state: PluginState;
}

export interface PluginManager {
  loadAll(): Promise<PluginLoadResult[]>;
  enable(id: string): Promise<void>;
  disable(id: string): Promise<void>;
  refresh(id?: string): Promise<void>;
  list(): readonly PluginState[];
}

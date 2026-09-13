import type { FluxoLogger } from "@fluxo/logger";
import type { PluginManifest } from "@fluxo/types";

export interface PluginContext {
  logger: FluxoLogger;
  config: Readonly<Record<string, unknown>>;
}

export interface FluxoPlugin {
  manifest: PluginManifest;
  onLoad?(ctx: PluginContext): Promise<void> | void;
  onEnable?(ctx: PluginContext): Promise<void> | void;
  onDisable?(ctx: PluginContext): Promise<void> | void;
  onUnload?(ctx: PluginContext): Promise<void> | void;
}

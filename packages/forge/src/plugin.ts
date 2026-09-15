import type { PluginContext } from "./context.js";
import type { PluginHealthResult } from "./health.js";
import type { PluginManifest } from "./manifest.js";
import type { PanelContributionManifest } from "./panel.js";

export abstract class FluxoPlugin {
  abstract readonly manifest: PluginManifest;
  onInstall?(ctx: PluginContext): Promise<void> | void;
  onEnable?(ctx: PluginContext): Promise<void> | void;
  onStart?(ctx: PluginContext): Promise<void> | void;
  onStop?(ctx: PluginContext): Promise<void> | void;
  onDisable?(ctx: PluginContext): Promise<void> | void;
  onUninstall?(ctx: PluginContext): Promise<void> | void;
  onLoad?(ctx: PluginContext): Promise<void> | void;
  onUnload?(ctx: PluginContext): Promise<void> | void;
  health?(ctx: PluginContext, signal: AbortSignal): Promise<PluginHealthResult>;
}

export abstract class FluxoPanelPlugin extends FluxoPlugin {
  contributions?(): readonly PanelContributionManifest[];
}

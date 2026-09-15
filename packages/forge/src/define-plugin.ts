import type { FluxoGatewayPlugin } from "./gateway.js";
import type { FluxoPanelPlugin, FluxoPlugin } from "./plugin.js";
import type { FluxoServicePlugin } from "./service.js";

export function definePlugin<T extends FluxoPlugin>(plugin: T): T {
  return plugin;
}

export function defineServicePlugin<T extends FluxoServicePlugin>(
  plugin: T,
): T {
  return plugin;
}

export function defineGatewayPlugin<T extends FluxoGatewayPlugin>(
  plugin: T,
): T {
  return plugin;
}

export function definePanelPlugin<T extends FluxoPanelPlugin>(plugin: T): T {
  return plugin;
}

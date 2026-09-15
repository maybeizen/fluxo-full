import type { PluginId } from "@fluxo/forge";
import type { PluginInstallState } from "./types.js";

const DEFAULT_STATE: PluginInstallState = {
  installed: false,
  enabled: false,
};

export function createMemoryInstallStore(
  initial: Readonly<Record<string, PluginInstallState>> = {},
): {
  getInstallState: (pluginId: PluginId) => PluginInstallState;
  setInstallState: (pluginId: PluginId, state: PluginInstallState) => void;
} {
  const states = new Map<string, PluginInstallState>(
    Object.entries(initial).map(([id, state]) => [id, { ...state }]),
  );

  return {
    getInstallState(pluginId: PluginId): PluginInstallState {
      const current = states.get(pluginId);
      return current ? { ...current } : { ...DEFAULT_STATE };
    },
    setInstallState(pluginId: PluginId, state: PluginInstallState): void {
      states.set(pluginId, { ...state });
    },
  };
}

import {
  parsePluginId,
  type PluginContext,
  type PluginId,
  type PluginLogger,
  type PluginPermission,
} from "@fluxo/forge";
import {
  createPluginManager,
  type PluginInstallState,
  type PluginManager,
} from "@fluxo/plugin-manager";
import type { UserStore } from "../auth/stores/types.js";
import type { SettingsRuntime } from "../settings/runtime.js";
import { createPluginContext, permissionsFromManifest } from "./context.js";
import { createForgeEventBus, type ForgeEventBus } from "./events.js";
import { createJobScheduler, type JobScheduler } from "./jobs.js";
import type { PluginInstallRow, PluginPersist } from "./persist.js";

export interface HostContextOptions {
  requestId?: string;
  operationId?: string;
  permissions?: readonly PluginPermission[];
  pluginVersion?: string;
}

export type HostContextFactory = (
  pluginId: PluginId,
  instanceId?: string,
  extras?: HostContextOptions,
) => Promise<PluginContext>;

export interface ForgeHost {
  readonly persist: PluginPersist;
  readonly manager: PluginManager;
  readonly events: ForgeEventBus;
  readonly jobs: JobScheduler;
  readonly createContext: HostContextFactory;
}

export interface CreateForgeHostOptions {
  persist: PluginPersist;
  logger: PluginLogger;
  pluginsDir: string;
  httpAllowlist?: readonly string[];
  users?: Pick<UserStore, "findById">;
  settings?: Pick<SettingsRuntime, "current">;
}

export function installStateFromRow(
  row: PluginInstallRow | undefined,
): PluginInstallState {
  if (row === undefined) {
    return { installed: false, enabled: false };
  }
  return { installed: true, enabled: row.enabled };
}

export function createInstallStateAdapter(
  persist: PluginPersist,
  resolveManifest?: (
    pluginId: PluginId,
  ) =>
    | {
        type: PluginInstallRow["type"];
        version: string;
        manifest: unknown;
      }
    | undefined,
): {
  getInstallState: (pluginId: PluginId) => Promise<PluginInstallState>;
  setInstallState: (pluginId: PluginId, state: PluginInstallState) => Promise<void>;
} {
  return {
    async getInstallState(pluginId) {
      const id = parsePluginId(pluginId);
      return installStateFromRow(await persist.getInstall(id));
    },
    async setInstallState(pluginId, state) {
      const id = parsePluginId(pluginId);
      const existing = await persist.getInstall(id);
      if (!state.installed) {
        if (existing === undefined) {
          return;
        }
        try {
          await persist.uninstall(id);
        } catch {
          return;
        }
        return;
      }
      if (existing !== undefined) {
        if (existing.enabled !== state.enabled) {
          try {
            await persist.setEnabled(id, state.enabled);
          } catch {
            return;
          }
        }
        return;
      }
      const definition = resolveManifest?.(id);
      if (definition === undefined) {
        return;
      }
      await persist.upsertInstall({
        id,
        type: definition.type,
        version: definition.version,
        manifest: definition.manifest,
        enabled: state.enabled,
        status: state.enabled ? "enabled" : "installed",
      });
    },
  };
}

export function createForgeHost(options: CreateForgeHostOptions): ForgeHost {
  const events = createForgeEventBus(options.logger);
  const jobs = createJobScheduler({
    logger: options.logger,
    isPluginEnabled: async (pluginId) => {
      const row = await options.persist.getInstall(pluginId);
      return row !== undefined && row.enabled;
    },
  });

  let manager!: PluginManager;

  const createContext: HostContextFactory = async (pluginId, instanceId, extras) => {
    const id = parsePluginId(pluginId);
    const meta = await resolvePluginMeta(options.persist, () => manager, id);
    return createPluginContext({
      pluginId: id,
      pluginVersion: extras?.pluginVersion ?? meta.version,
      instanceId,
      persist: options.persist,
      permissions: extras?.permissions ?? meta.permissions,
      logger: options.logger,
      events,
      jobs,
      users: options.users,
      settings: options.settings,
      httpAllowlist: options.httpAllowlist,
      requestId: extras?.requestId,
      operationId: extras?.operationId,
    });
  };

  const installState = createInstallStateAdapter(options.persist, (pluginId) => {
    const definition = manager?.list().find((item) => item.id === pluginId);
    if (!definition) {
      return undefined;
    }
    return {
      type: definition.type,
      version: definition.manifest.version,
      manifest: definition.manifest,
    };
  });

  manager = createPluginManager({
    directory: options.pluginsDir,
    logger: options.logger,
    createContext: (pluginId) => createContext(pluginId),
    getInstallState: installState.getInstallState,
    setInstallState: installState.setInstallState,
  });

  return {
    persist: options.persist,
    manager,
    events,
    jobs,
    createContext,
  };
}

async function resolvePluginMeta(
  persist: PluginPersist,
  getManager: () => PluginManager | undefined,
  pluginId: PluginId,
): Promise<{ version: string; permissions: PluginPermission[] }> {
  const install = await persist.getInstall(pluginId);
  if (install !== undefined) {
    return {
      version: install.version,
      permissions: permissionsFromManifest(install.manifest),
    };
  }
  const definition = getManager()?.list().find((item) => item.id === pluginId);
  if (definition) {
    return {
      version: definition.manifest.version,
      permissions: definition.manifest.permissions ?? [],
    };
  }
  return { version: "0.0.0", permissions: [] };
}

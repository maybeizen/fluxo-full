import {
  parsePluginId,
  type FluxoGatewayPlugin,
  type FluxoPlugin,
  type FluxoServicePlugin,
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
import {
  applyManifestPermissions,
  createPluginContext,
  intersectPluginPermissions,
  permissionsFromManifest,
} from "./context.js";
import { createForgeEventBus, type ForgeEventBus } from "./events.js";
import {
  createGatewayRegistry,
  type FluxoGatewayRegistry,
} from "./gateway-registry.js";
import { createJobScheduler, type JobScheduler } from "./jobs.js";
import type { PluginInstallRow, PluginPersist } from "./persist.js";
import {
  createServiceRegistry,
  type HostServiceRegistry,
} from "./service-registry.js";

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
  readonly services: HostServiceRegistry;
  readonly gateways: FluxoGatewayRegistry;
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
  resolveManifest?: (pluginId: PluginId) =>
    | {
        type: PluginInstallRow["type"];
        version: string;
        manifest: unknown;
      }
    | undefined,
): {
  getInstallState: (pluginId: PluginId) => Promise<PluginInstallState>;
  setInstallState: (
    pluginId: PluginId,
    state: PluginInstallState,
  ) => Promise<void>;
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

  const holder: { manager?: PluginManager } = {};

  const createContext: HostContextFactory = async (
    pluginId,
    instanceId,
    extras,
  ) => {
    const id = parsePluginId(pluginId);
    const meta = await resolvePluginMeta(
      options.persist,
      () => holder.manager,
      id,
    );
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

  const installState = createInstallStateAdapter(
    options.persist,
    (pluginId) => {
      const definition = holder.manager
        ?.list()
        .find((item) => item.id === pluginId);
      if (!definition) {
        return undefined;
      }
      return {
        type: definition.type,
        version: definition.manifest.version,
        manifest: definition.manifest,
      };
    },
  );

  const loaded = createPluginManager({
    directory: options.pluginsDir,
    logger: options.logger,
    createContext: (pluginId) => createContext(pluginId),
    getInstallState: installState.getInstallState,
    setInstallState: installState.setInstallState,
  });
  const manager: PluginManager = {
    ...loaded,
    async loadAll() {
      const results = await loaded.loadAll();
      await syncInstallManifests(options.persist, loaded);
      return results;
    },
    async refresh(id) {
      await loaded.refresh(id);
      await syncInstallManifests(options.persist, loaded, id);
    },
  };
  holder.manager = manager;

  const isPluginActive = (pluginId: string) =>
    manager.getActive(pluginId) !== undefined;

  const services = createServiceRegistry({
    persist: options.persist,
    getServicePlugin(pluginId) {
      return asServicePlugin(manager.getActive(pluginId));
    },
    isPluginActive,
    createContext: (pluginId, instanceId) =>
      createContext(pluginId, instanceId),
  });

  const gateways = createGatewayRegistry({
    persist: options.persist,
    getGatewayPlugin(pluginId) {
      return asGatewayPlugin(manager.getActive(pluginId));
    },
    isPluginActive,
    createContext: (pluginId, instanceId) =>
      createContext(pluginId, instanceId),
  });

  return {
    persist: options.persist,
    manager,
    services,
    gateways,
    events,
    jobs,
    createContext,
  };
}

function asServicePlugin(
  plugin: FluxoPlugin | undefined,
): FluxoServicePlugin | undefined {
  if (
    plugin &&
    typeof (plugin as FluxoServicePlugin).provision === "function" &&
    typeof (plugin as FluxoServicePlugin).capabilities === "function"
  ) {
    return plugin as FluxoServicePlugin;
  }
  return undefined;
}

export function asGatewayPlugin(
  plugin: FluxoPlugin | undefined,
): FluxoGatewayPlugin | undefined {
  if (
    plugin &&
    typeof (plugin as FluxoGatewayPlugin).createCheckout === "function" &&
    typeof (plugin as FluxoGatewayPlugin).getPaymentStatus === "function"
  ) {
    return plugin as FluxoGatewayPlugin;
  }
  return undefined;
}

async function resolvePluginMeta(
  persist: PluginPersist,
  getManager: () => PluginManager | undefined,
  pluginId: PluginId,
): Promise<{ version: string; permissions: PluginPermission[] }> {
  const install = await persist.getInstall(pluginId);
  const definition = getManager()
    ?.list()
    .find((item) => item.id === pluginId);
  const installPermissions = install
    ? permissionsFromManifest(install.manifest)
    : [];
  const diskPermissions = definition
    ? permissionsFromManifest(definition.manifest)
    : undefined;
  const permissions =
    diskPermissions === undefined
      ? installPermissions
      : install === undefined
        ? diskPermissions
        : intersectPluginPermissions(diskPermissions, installPermissions);
  return {
    version: definition?.manifest.version ?? install?.version ?? "0.0.0",
    permissions,
  };
}

async function syncInstallManifests(
  persist: PluginPersist,
  manager: PluginManager,
  pluginId?: PluginId,
): Promise<void> {
  const definitions =
    pluginId === undefined
      ? manager.list()
      : manager.list().filter((item) => item.id === pluginId);
  for (const definition of definitions) {
    const install = await persist.getInstall(definition.id);
    if (install === undefined) {
      continue;
    }
    const permissions = intersectPluginPermissions(
      permissionsFromManifest(definition.manifest),
      permissionsFromManifest(install.manifest),
    );
    const manifest = applyManifestPermissions(
      definition.manifest,
      permissions,
    );
    await persist.upsertInstall({
      id: install.id,
      type: definition.type,
      version: definition.manifest.version,
      manifest,
      enabled: install.enabled,
      status: install.status,
      error: install.error,
      discoveredPath: install.discoveredPath,
      contentHash: install.contentHash,
    });
  }
}

import {
  ForgePermissionError,
  PLUGIN_PERMISSIONS,
  isSensitiveConfigKey,
  parsePluginId,
  type JsonValue,
  type PluginConfig,
  type PluginConfigField,
  type PluginContext,
  type PluginId,
  type PluginLogger,
  type PluginPermission,
} from "@fluxo/forge";
import type { UserStore } from "../auth/stores/types.js";
import type { SettingsRuntime } from "../settings/runtime.js";
import { createPluginEvents, type ForgeEventBus } from "./events.js";
import { createPluginHttp } from "./http.js";
import { createPluginJobs, type JobScheduler } from "./jobs.js";
import { createPluginLogger } from "./logger.js";
import { createPluginStorage, type PluginPersist } from "./persist.js";
import { createPluginSettingsApi } from "./settings-api.js";
import { createPluginUsersApi } from "./users-api.js";

const PERMISSION_SET = new Set<string>(PLUGIN_PERMISSIONS);

export interface CreatePluginContextOptions {
  pluginId: string;
  pluginVersion: string;
  instanceId?: string;
  persist: PluginPersist;
  permissions: readonly PluginPermission[];
  logger: PluginLogger;
  events: ForgeEventBus;
  jobs: JobScheduler;
  users?: Pick<UserStore, "findById">;
  settings?: Pick<SettingsRuntime, "current">;
  httpAllowlist?: readonly string[];
  requestId?: string;
  operationId?: string;
}

export async function createPluginContext(
  options: CreatePluginContextOptions,
): Promise<PluginContext> {
  const pluginId = parsePluginId(options.pluginId);
  const permissions = uniquePermissions(options.permissions);
  const config = await loadPluginConfig(options.persist, pluginId, options.instanceId);
  const secretValues = Object.values(config.secrets);
  const logger = createPluginLogger({
    logger: options.logger,
    pluginId,
    pluginVersion: options.pluginVersion,
    instanceId: options.instanceId,
    requestId: options.requestId,
    operationId: options.operationId,
    secrets: secretValues,
  });
  const storage = createPermissionedStorage(
    createPluginStorage(options.persist, pluginId),
    permissions,
  );

  const context: PluginContext = {
    pluginId,
    logger,
    config: createConfigApi(config),
    storage,
    events: createPluginEvents({ pluginId, permissions, bus: options.events }),
    jobs: createPluginJobs({ pluginId, permissions, scheduler: options.jobs }),
    http: createPluginHttp({
      pluginId,
      permissions,
      allowlist: options.httpAllowlist ?? [],
      logger,
    }),
    users: createPluginUsersApi({ permissions, users: options.users }),
    settings: createPluginSettingsApi({ permissions, settings: options.settings }),
  };
  if (options.instanceId !== undefined) {
    return { ...context, instanceId: options.instanceId };
  }
  return context;
}

function createPermissionedStorage(
  storage: ReturnType<typeof createPluginStorage>,
  permissions: readonly PluginPermission[],
) {
  const allowed = new Set(permissions);
  return {
    async get(key: string) {
      if (!allowed.has("storage.read")) {
        throw new ForgePermissionError("storage.read");
      }
      return storage.get(key);
    },
    async set(key: string, value: JsonValue) {
      if (!allowed.has("storage.write")) {
        throw new ForgePermissionError("storage.write");
      }
      await storage.set(key, value);
    },
    async delete(key: string) {
      if (!allowed.has("storage.write")) {
        throw new ForgePermissionError("storage.write");
      }
      await storage.delete(key);
    },
    async keys(prefix?: string) {
      if (!allowed.has("storage.read")) {
        throw new ForgePermissionError("storage.read");
      }
      return storage.keys(prefix);
    },
  };
}

function createConfigApi(config: LoadedConfig): PluginConfig {
  return {
    get(key) {
      if (Object.hasOwn(config.secrets, key)) {
        return undefined;
      }
      return config.values[key];
    },
    getSecret(key) {
      return config.secrets[key];
    },
    all() {
      return { ...config.values };
    },
  };
}

interface LoadedConfig {
  values: Record<string, JsonValue>;
  secrets: Record<string, string>;
}

async function loadPluginConfig(
  persist: PluginPersist,
  pluginId: PluginId,
  instanceId: string | undefined,
): Promise<LoadedConfig> {
  const values: Record<string, JsonValue> = {};
  const secrets: Record<string, string> = {};
  const secretFields = await secretFieldKeys(persist, pluginId);

  if (instanceId !== undefined) {
    const instance = await persist.getInstance(instanceId);
    if (instance !== undefined && instance.pluginId === pluginId) {
      for (const [key, value] of Object.entries(instance.config)) {
        if (secretFields.has(key)) {
          continue;
        }
        values[key] = value;
      }
    }
  }

  await loadSecrets(persist, pluginId, undefined, secrets);
  if (instanceId !== undefined) {
    await loadSecrets(persist, pluginId, instanceId, secrets);
  }
  return { values, secrets };
}

async function loadSecrets(
  persist: PluginPersist,
  pluginId: PluginId,
  instanceId: string | undefined,
  target: Record<string, string>,
): Promise<void> {
  const keys = await persist.listSecretKeysSet(pluginId, instanceId);
  for (const key of keys) {
    const value = await persist.getSecret(pluginId, key, instanceId);
    if (value !== null) {
      target[key] = value;
    }
  }
}

async function secretFieldKeys(
  persist: PluginPersist,
  pluginId: PluginId,
): Promise<Set<string>> {
  const install = await persist.getInstall(pluginId);
  const fields = configFieldsFromManifest(install?.manifest);
  const keys = new Set<string>();
  for (const field of fields) {
    if (isSensitiveConfigKey(field.key, fields)) {
      keys.add(field.key);
    }
  }
  return keys;
}

function configFieldsFromManifest(manifest: unknown): PluginConfigField[] {
  if (typeof manifest !== "object" || manifest === null || !("config" in manifest)) {
    return [];
  }
  const config = (manifest as { config?: unknown }).config;
  if (!Array.isArray(config)) {
    return [];
  }
  return config.filter((field): field is PluginConfigField => {
    return (
      typeof field === "object" &&
      field !== null &&
      "key" in field &&
      "type" in field &&
      typeof (field as { key: unknown }).key === "string"
    );
  });
}

export function permissionsFromManifest(manifest: unknown): PluginPermission[] {
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return [];
  }
  const record = manifest as Record<string, unknown>;
  if (!Array.isArray(record.permissions)) {
    return [];
  }
  const permissions: PluginPermission[] = [];
  for (const item of record.permissions) {
    if (typeof item === "string" && PERMISSION_SET.has(item)) {
      permissions.push(item as PluginPermission);
    }
  }
  return permissions;
}

function uniquePermissions(
  permissions: readonly PluginPermission[],
): PluginPermission[] {
  return [...new Set(permissions)];
}

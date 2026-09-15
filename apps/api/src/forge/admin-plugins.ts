import {
  FORGE_API_VERSION,
  FORGE_HEALTH_TIMEOUT_MS,
  ForgeConfigError,
  ForgeConflictError,
  ForgeNotFoundError,
  ForgeTimeoutError,
  REDACTED,
  forgeApiSatisfied,
  pluginConfigFieldSchema,
  parsePluginId,
  type FluxoPlugin,
  type JsonValue,
  type PluginConfigField,
  type PluginContext,
  type PluginDefinition,
  type PluginDefinitionRecord,
  type PluginHealthSnapshot,
  type PluginId,
  type PluginInstanceRecord,
  jsonValueSchema,
} from "@fluxo/forge";
import {
  applyManifestPermissions,
  intersectPluginPermissions,
  permissionsFromManifest,
} from "./context.js";
import {
  toPluginConfigPublic,
  toPluginDefinitionRecord,
  toPluginInstanceRecord,
  validatePluginConfig,
  type PluginInstallRow,
  type PluginPersist,
} from "./persist.js";

export const PLUGIN_ADMIN_CONFIG_KV_KEY = "fluxo/admin-config";

export interface AdminPluginManager {
  listDefinitions(): Promise<readonly PluginDefinition[]>;
  getDefinition(id: PluginId): Promise<PluginDefinition | null>;
  install?(id: PluginId): Promise<void>;
  enable(id: PluginId): Promise<void>;
  disable(id: PluginId): Promise<void>;
  uninstall(id: PluginId): Promise<void>;
  getActive(id: PluginId): FluxoPlugin | undefined;
  getPlugin?(id: PluginId): FluxoPlugin | undefined;
}

export type AdminPluginContextFactory = (
  pluginId: PluginId,
  instanceId?: string,
) => PluginContext | Promise<PluginContext>;

export interface AdminPluginServiceOptions {
  persist: PluginPersist;
  manager?: AdminPluginManager;
  createContext?: AdminPluginContextFactory;
}

export interface AdminPluginCompatibility {
  ok: boolean;
  forgeApi: string;
  hostVersion: string;
}

export interface AdminPluginView extends PluginDefinitionRecord {
  enabled: boolean;
  installed: boolean;
  discovered: boolean;
  compatibility: AdminPluginCompatibility;
}

export interface AdminPluginConfigView {
  schema: PluginConfigField[];
  values: Record<string, JsonValue>;
  secretKeysSet: string[];
}

export interface AdminPluginService {
  list(): Promise<AdminPluginView[]>;
  get(pluginId: string): Promise<AdminPluginView>;
  enable(pluginId: string): Promise<AdminPluginView>;
  disable(pluginId: string): Promise<AdminPluginView>;
  uninstall(
    pluginId: string,
    options?: { purgeStorage?: boolean },
  ): Promise<void>;
  getConfig(pluginId: string): Promise<AdminPluginConfigView>;
  putConfig(pluginId: string, input: unknown): Promise<AdminPluginConfigView>;
  checkHealth(
    pluginId: string,
    instanceId?: string,
  ): Promise<PluginHealthSnapshot>;
  listInstances(pluginId: string): Promise<PluginInstanceRecord[]>;
  getInstance(
    pluginId: string,
    instanceId: string,
  ): Promise<PluginInstanceRecord>;
  createInstance(
    pluginId: string,
    input: {
      displayName: string;
      enabled?: boolean;
      config?: Record<string, JsonValue>;
    },
  ): Promise<PluginInstanceRecord>;
  updateInstance(
    pluginId: string,
    instanceId: string,
    input: { displayName?: string; enabled?: boolean },
  ): Promise<PluginInstanceRecord>;
  setInstanceEnabled(
    pluginId: string,
    instanceId: string,
    enabled: boolean,
  ): Promise<PluginInstanceRecord>;
  deleteInstance(pluginId: string, instanceId: string): Promise<void>;
  getInstanceConfig(
    pluginId: string,
    instanceId: string,
  ): Promise<AdminPluginConfigView>;
  putInstanceConfig(
    pluginId: string,
    instanceId: string,
    input: unknown,
  ): Promise<AdminPluginConfigView>;
}

export function createAdminPluginService(
  options: AdminPluginServiceOptions,
): AdminPluginService {
  const persist = options.persist;
  const manager = options.manager;
  const createContext = options.createContext ?? createFallbackContext;

  async function requireView(pluginId: string): Promise<{
    id: PluginId;
    view: AdminPluginView;
    install: PluginInstallRow | undefined;
    definition: PluginDefinition | undefined;
  }> {
    const id = parsePluginId(pluginId);
    const install = await persist.getInstall(id);
    const definition = (await manager?.getDefinition(id)) ?? undefined;
    if (!install && !definition) {
      throw new ForgeNotFoundError(`plugin ${id}`);
    }
    const view = await toView(persist, id, install, definition);
    return { id, view, install, definition };
  }

  async function requireOwnedInstance(pluginId: string, instanceId: string) {
    const id = parsePluginId(pluginId);
    await requireView(id);
    const instance = await persist.getInstance(instanceId);
    if (!instance || instance.pluginId !== id) {
      throw new ForgeNotFoundError(`plugin instance ${instanceId}`);
    }
    return instance;
  }

  async function instanceRecord(instance: {
    id: string;
    pluginId: string;
    kind: "service" | "gateway";
    displayName: string;
    enabled: boolean;
    config: Record<string, JsonValue>;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<PluginInstanceRecord> {
    const secretKeysSet = await persist.listSecretKeysSet(
      instance.pluginId,
      instance.id,
    );
    return toPluginInstanceRecord(instance, secretKeysSet);
  }

  return {
    async list() {
      const installs = await persist.listInstalls();
      const definitions = manager ? [...(await manager.listDefinitions())] : [];
      const installMap = new Map(installs.map((row) => [row.id, row]));
      const definitionMap = new Map(definitions.map((row) => [row.id, row]));
      const ids = new Set<string>([
        ...installMap.keys(),
        ...definitionMap.keys(),
      ]);
      const views: AdminPluginView[] = [];
      for (const id of ids) {
        views.push(
          await toView(persist, id, installMap.get(id), definitionMap.get(id)),
        );
      }
      views.sort((left, right) => left.id.localeCompare(right.id));
      return views;
    },

    async get(pluginId) {
      const { view } = await requireView(pluginId);
      return view;
    },

    async enable(pluginId) {
      const { id, install, definition } = await requireView(pluginId);
      if (!install) {
        if (!definition) {
          throw new ForgeNotFoundError(`plugin ${id}`);
        }
        await persist.upsertInstall({
          id,
          type: definition.type,
          version: definition.manifest.version,
          manifest: definition.manifest,
          status: "installed",
          enabled: false,
          error: definition.error ?? null,
        });
      }
      if (manager) {
        if (manager.install) {
          await manager.install(id);
        }
        await manager.enable(id);
        await syncManagerFailure(persist, manager, id);
      }
      await persist.setEnabled(id, true);
      return (await requireView(id)).view;
    },

    async disable(pluginId) {
      const { id } = await requireView(pluginId);
      await persist.assertCanDisable(id);
      if (manager) {
        await manager.disable(id);
        await syncManagerFailure(persist, manager, id);
      }
      await persist.setEnabled(id, false);
      return (await requireView(id)).view;
    },

    async uninstall(pluginId, uninstallOptions) {
      const { id } = await requireView(pluginId);
      await persist.assertCanUninstall(id);
      if (manager) {
        await manager.uninstall(id);
      }
      await persist.uninstall(id, {
        purgeStorage: uninstallOptions?.purgeStorage === true,
      });
    },

    async getConfig(pluginId) {
      const { id, install, definition } = await requireView(pluginId);
      const schema = readConfigSchema(
        definition?.manifest ?? install?.manifest,
      );
      const values = await readPluginPublicValues(persist, id);
      const secretKeysSet = [...(await persist.listSecretKeysSet(id))];
      const publicConfig = toPluginConfigPublic(values, secretKeysSet);
      return {
        schema,
        values: { ...publicConfig.values },
        secretKeysSet: [...publicConfig.secretKeysSet],
      };
    },

    async putConfig(pluginId, input) {
      const { id, install, definition } = await requireView(pluginId);
      if (!install) {
        if (!definition) {
          throw new ForgeNotFoundError(`plugin ${id}`);
        }
        await persist.upsertInstall({
          id,
          type: definition.type,
          version: definition.manifest.version,
          manifest: definition.manifest,
          status: definition.status,
          enabled: false,
          error: definition.error ?? null,
        });
      }
      const current = install ?? (await persist.getInstall(id));
      if (!current) {
        throw new ForgeNotFoundError(`plugin ${id}`);
      }
      const schema = readConfigSchema(definition?.manifest ?? current.manifest);
      const currentValues = await readPluginPublicValues(persist, id);
      const secretKeysSet = await persist.listSecretKeysSet(id);
      const patched = applyPluginConfigPatch(
        schema,
        input,
        currentValues,
        secretKeysSet,
      );
      await persist.setKv(id, PLUGIN_ADMIN_CONFIG_KV_KEY, patched.values);
      await writeSecrets(persist, id, patched.secretWrites);
      const nextSecrets = [...(await persist.listSecretKeysSet(id))];
      const publicConfig = toPluginConfigPublic(patched.values, nextSecrets);
      return {
        schema,
        values: { ...publicConfig.values },
        secretKeysSet: [...publicConfig.secretKeysSet],
      };
    },

    async checkHealth(pluginId, instanceId) {
      const { id, view } = await requireView(pluginId);
      if (instanceId !== undefined) {
        await requireOwnedInstance(id, instanceId);
      }
      return runHealthCheck({
        persist,
        manager,
        createContext,
        pluginId: id,
        instanceId,
        fallbackStatus: view.status,
        fallbackError: view.error,
        schema: readConfigSchema(
          (await manager?.getDefinition(id))?.manifest ??
            (await persist.getInstall(id))?.manifest,
        ),
      });
    },

    async listInstances(pluginId) {
      const { id, view } = await requireView(pluginId);
      if (view.type === "panel") {
        return [];
      }
      const rows = await persist.listInstances(id);
      return Promise.all(rows.map((row) => instanceRecord(row)));
    },

    async getInstance(pluginId, instanceId) {
      const instance = await requireOwnedInstance(pluginId, instanceId);
      return instanceRecord(instance);
    },

    async createInstance(pluginId, input) {
      const { id, view, install, definition } = await requireView(pluginId);
      if (view.type === "panel") {
        throw new ForgeConfigError("Panel plugins do not have instances");
      }
      if (view.type !== "service" && view.type !== "gateway") {
        throw new ForgeConfigError("Instance kind must match plugin type");
      }
      if (!view.installed) {
        throw new ForgeConflictError(`Plugin is not installed: ${id}`);
      }
      const schema = readConfigSchema(
        definition?.manifest ?? install?.manifest,
      );
      const patched =
        input.config === undefined
          ? { values: {}, secretWrites: {} }
          : applyPluginConfigPatch(schema, input.config, {}, []);
      const row = await persist.createInstance({
        pluginId: id,
        kind: view.type,
        displayName: input.displayName,
        enabled: input.enabled,
        config: patched.values,
      });
      await writeSecrets(persist, id, patched.secretWrites, row.id);
      const stored = await persist.getInstance(row.id);
      return instanceRecord(stored ?? row);
    },

    async updateInstance(pluginId, instanceId, input) {
      await requireOwnedInstance(pluginId, instanceId);
      const row = await persist.updateInstance(instanceId, {
        displayName: input.displayName,
        enabled: input.enabled,
      });
      return instanceRecord(row);
    },

    async setInstanceEnabled(pluginId, instanceId, enabled) {
      await requireOwnedInstance(pluginId, instanceId);
      const row = await persist.setInstanceEnabled(instanceId, enabled);
      return instanceRecord(row);
    },

    async deleteInstance(pluginId, instanceId) {
      await requireOwnedInstance(pluginId, instanceId);
      await persist.deleteInstance(instanceId);
    },

    async getInstanceConfig(pluginId, instanceId) {
      const instance = await requireOwnedInstance(pluginId, instanceId);
      const install = await persist.getInstall(instance.pluginId);
      const definition = await manager?.getDefinition(instance.pluginId);
      const schema = readConfigSchema(
        definition?.manifest ?? install?.manifest,
      );
      const secretKeysSet = [
        ...(await persist.listSecretKeysSet(instance.pluginId, instance.id)),
      ];
      const publicConfig = toPluginConfigPublic(instance.config, secretKeysSet);
      return {
        schema,
        values: { ...publicConfig.values },
        secretKeysSet: [...publicConfig.secretKeysSet],
      };
    },

    async putInstanceConfig(pluginId, instanceId, input) {
      const instance = await requireOwnedInstance(pluginId, instanceId);
      const install = await persist.getInstall(instance.pluginId);
      const definition = await manager?.getDefinition(instance.pluginId);
      const schema = readConfigSchema(
        definition?.manifest ?? install?.manifest,
      );
      const secretKeysSet = await persist.listSecretKeysSet(
        instance.pluginId,
        instance.id,
      );
      const patched = applyPluginConfigPatch(
        schema,
        input,
        instance.config,
        secretKeysSet,
      );
      const row = await persist.updateInstance(instance.id, {
        config: patched.values,
      });
      await writeSecrets(
        persist,
        instance.pluginId,
        patched.secretWrites,
        instance.id,
      );
      const nextSecrets = [
        ...(await persist.listSecretKeysSet(instance.pluginId, instance.id)),
      ];
      const publicConfig = toPluginConfigPublic(row.config, nextSecrets);
      return {
        schema,
        values: { ...publicConfig.values },
        secretKeysSet: [...publicConfig.secretKeysSet],
      };
    },
  };
}

export function applyPluginConfigPatch(
  schema: readonly PluginConfigField[],
  input: unknown,
  currentValues: Readonly<Record<string, JsonValue>>,
  secretKeysSet: readonly string[],
): {
  values: Record<string, JsonValue>;
  secretWrites: Record<string, string | null>;
} {
  if (
    input === undefined ||
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new ForgeConfigError("Config must be an object");
  }
  const record = input as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...currentValues };
  const secretWrites: Record<string, string | null> = {};
  const keptSecrets = new Set<string>();
  const setSecrets = new Set(secretKeysSet);

  for (const field of schema) {
    const provided = Object.hasOwn(record, field.key);
    const raw = provided ? record[field.key] : undefined;
    if (field.type === "secret") {
      if (!provided || raw === undefined || raw === "") {
        if (setSecrets.has(field.key)) {
          merged[field.key] = "kept";
          keptSecrets.add(field.key);
        } else {
          delete merged[field.key];
        }
        continue;
      }
      if (raw === null) {
        delete merged[field.key];
        secretWrites[field.key] = null;
        continue;
      }
      if (typeof raw !== "string") {
        throw new ForgeConfigError(
          `Invalid type for ${field.key}: expected secret`,
        );
      }
      merged[field.key] = raw;
      secretWrites[field.key] = raw;
      continue;
    }
    if (provided) {
      merged[field.key] = raw;
    }
  }

  const validated = validatePluginConfig(schema, merged);
  for (const [key, value] of Object.entries(validated.secrets)) {
    if (keptSecrets.has(key)) {
      continue;
    }
    secretWrites[key] = value;
  }
  return { values: validated.values, secretWrites };
}

export function readConfigSchema(manifest: unknown): PluginConfigField[] {
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    Array.isArray(manifest)
  ) {
    return [];
  }
  const config = (manifest as { config?: unknown }).config;
  if (!Array.isArray(config)) {
    return [];
  }
  const fields: PluginConfigField[] = [];
  for (const item of config) {
    const parsed = pluginConfigFieldSchema.safeParse(item);
    if (parsed.success) {
      fields.push(parsed.data);
    }
  }
  return fields;
}

export function redactHealthMessage(
  message: string,
  secrets: readonly string[],
): string {
  let output = message;
  for (const secret of secrets) {
    if (secret.length === 0) {
      continue;
    }
    output = output.split(secret).join(REDACTED);
  }
  return output.replace(
    /"ciphertext"\s*:\s*"[^"]*"/g,
    `"ciphertext":"${REDACTED}"`,
  );
}

function createFallbackContext(
  pluginId: PluginId,
  instanceId?: string,
): PluginContext {
  const logger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return logger;
    },
  };
  const context: PluginContext = {
    pluginId,
    logger,
    config: {
      get: () => undefined,
      getSecret: () => undefined,
      all: () => ({}),
    },
    storage: {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
      keys: async () => [],
    },
    events: {
      on: () => () => undefined,
      onCustom: () => () => undefined,
      emitCustom: async () => undefined,
    },
    jobs: {
      schedule: async () => ({ jobId: "job" }),
      cancel: async () => undefined,
      handle: () => () => undefined,
    },
    http: {
      request: async () => ({ status: 200, headers: {}, body: {} }),
    },
    users: {
      getById: async () => null,
    },
    settings: {
      getPublic: async () => ({
        appName: "Fluxo",
        appBaseUrl: "http://localhost:5173",
        billingCurrency: "USD",
        billingLocale: "en-US",
        billingTimezone: "UTC",
      }),
    },
  };
  if (instanceId !== undefined) {
    return { ...context, instanceId };
  }
  return context;
}

async function toView(
  persist: PluginPersist,
  pluginId: string,
  install: PluginInstallRow | undefined,
  definition: PluginDefinition | undefined,
): Promise<AdminPluginView> {
  const instanceCount = await persist.countInstances(pluginId);
  const record = install
    ? toPluginDefinitionRecord(
        overlayInstall(install, definition),
        instanceCount,
      )
    : toPluginDefinitionRecord(
        installFromDefinition(definition as PluginDefinition),
        instanceCount,
      );
  const forgeApi = record.forgeApi;
  return {
    ...record,
    enabled: install?.enabled ?? false,
    installed: install !== undefined,
    discovered: definition !== undefined,
    compatibility: {
      ok: forgeApi.length > 0 && forgeApiSatisfied(forgeApi, FORGE_API_VERSION),
      forgeApi,
      hostVersion: FORGE_API_VERSION,
    },
  };
}

function overlayInstall(
  install: PluginInstallRow,
  definition: PluginDefinition | undefined,
): PluginInstallRow {
  if (!definition) {
    return install;
  }
  const permissions = intersectPluginPermissions(
    permissionsFromManifest(definition.manifest),
    permissionsFromManifest(install.manifest),
  );
  return {
    ...install,
    status: definition.status,
    error: definition.error === undefined ? install.error : definition.error,
    type: definition.type,
    version: definition.manifest.version,
    manifest: applyManifestPermissions(definition.manifest, permissions),
  };
}

function installFromDefinition(definition: PluginDefinition): PluginInstallRow {
  const now = new Date(0);
  return {
    id: definition.id,
    type: definition.type,
    version: definition.manifest.version,
    enabled: false,
    status: definition.status,
    error: definition.error ?? null,
    discoveredPath: null,
    contentHash: null,
    manifest: definition.manifest,
    createdAt: now,
    updatedAt: now,
  };
}

async function readPluginPublicValues(
  persist: PluginPersist,
  pluginId: string,
): Promise<Record<string, JsonValue>> {
  const stored = await persist.getKv(pluginId, PLUGIN_ADMIN_CONFIG_KV_KEY);
  if (
    stored === undefined ||
    stored === null ||
    typeof stored !== "object" ||
    Array.isArray(stored)
  ) {
    return {};
  }
  const parsed = jsonValueSchema.safeParse(stored);
  if (
    !parsed.success ||
    typeof parsed.data !== "object" ||
    parsed.data === null ||
    Array.isArray(parsed.data)
  ) {
    return {};
  }
  return parsed.data as Record<string, JsonValue>;
}

async function writeSecrets(
  persist: PluginPersist,
  pluginId: string,
  secretWrites: Record<string, string | null>,
  instanceId?: string,
): Promise<void> {
  for (const [key, value] of Object.entries(secretWrites)) {
    await persist.setSecret(pluginId, key, value, instanceId);
  }
}

async function syncManagerFailure(
  persist: PluginPersist,
  manager: AdminPluginManager,
  pluginId: PluginId,
): Promise<void> {
  const definition = await manager.getDefinition(pluginId);
  if (definition?.status === "error") {
    const message = definition.error ?? "Plugin operation failed";
    await persist.recordFailure(pluginId, message);
    throw new ForgeConflictError(message);
  }
}

async function collectSecretValues(
  persist: PluginPersist,
  pluginId: string,
  schema: readonly PluginConfigField[],
  instanceId?: string,
): Promise<string[]> {
  const keys = schema
    .filter((field) => field.type === "secret")
    .map((field) => field.key);
  const listed = await persist.listSecretKeysSet(pluginId, instanceId);
  const unique = new Set([...keys, ...listed]);
  const values: string[] = [];
  for (const key of unique) {
    const value = await persist.getSecret(pluginId, key, instanceId);
    if (value && value.length > 0) {
      values.push(value);
    }
  }
  return values;
}

async function runHealthCheck(options: {
  persist: PluginPersist;
  manager: AdminPluginManager | undefined;
  createContext: AdminPluginContextFactory;
  pluginId: PluginId;
  instanceId?: string;
  fallbackStatus: AdminPluginView["status"];
  fallbackError?: string;
  schema: PluginConfigField[];
}): Promise<PluginHealthSnapshot> {
  const secrets = await collectSecretValues(
    options.persist,
    options.pluginId,
    options.schema,
    options.instanceId,
  );
  const startedAt = Date.now();
  const plugin =
    options.manager?.getPlugin?.(options.pluginId) ??
    options.manager?.getActive(options.pluginId);
  const checkedAt = new Date().toISOString();

  if (!plugin?.health) {
    const status =
      options.fallbackStatus === "error"
        ? "unhealthy"
        : options.fallbackStatus === "started" ||
            options.fallbackStatus === "enabled"
          ? "ok"
          : "degraded";
    const snapshot: PluginHealthSnapshot = {
      status,
      pluginId: options.pluginId,
      checkedAt,
      latencyMs: Date.now() - startedAt,
    };
    if (options.instanceId !== undefined) {
      snapshot.instanceId = options.instanceId;
    }
    if (options.fallbackError) {
      snapshot.message = redactHealthMessage(options.fallbackError, secrets);
    }
    return snapshot;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FORGE_HEALTH_TIMEOUT_MS);
  try {
    const ctx = await options.createContext(
      options.pluginId,
      options.instanceId,
    );
    const result = await plugin.health(ctx, controller.signal);
    const snapshot: PluginHealthSnapshot = {
      status: result.status,
      pluginId: options.pluginId,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    };
    if (options.instanceId !== undefined) {
      snapshot.instanceId = options.instanceId;
    }
    if (result.message) {
      snapshot.message = redactHealthMessage(result.message, secrets);
    }
    return snapshot;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ForgeTimeoutError("Plugin health check timed out");
    }
    const message =
      error instanceof Error ? error.message : "Plugin health check failed";
    const snapshot: PluginHealthSnapshot = {
      status: "unhealthy",
      pluginId: options.pluginId,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      message: redactHealthMessage(message, secrets),
    };
    if (options.instanceId !== undefined) {
      snapshot.instanceId = options.instanceId;
    }
    return snapshot;
  } finally {
    clearTimeout(timer);
  }
}

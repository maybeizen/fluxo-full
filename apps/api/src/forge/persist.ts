import {
  pluginInstalls,
  pluginInstances,
  pluginKv,
  pluginSecrets,
  type FluxoDatabase,
} from "@fluxo/db";
import {
  ForgeConfigError,
  ForgeConflictError,
  ForgeNotFoundError,
  ForgeValidationError,
  PLUGIN_PERMISSIONS,
  PLUGIN_TYPES,
  assertNoPrototypePollution,
  isForbiddenObjectKey,
  isSafeStorageKey,
  jsonValueSchema,
  parseInstanceId,
  parsePluginId,
  type JsonValue,
  type PluginConfigField,
  type PluginConfigPublic,
  type PluginDefinitionRecord,
  type PluginInstanceRecord,
  type PluginLifecycleStatus,
  type PluginPermission,
  type PluginStorage,
  type PluginType,
} from "@fluxo/forge";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { openSecret, sealSecret } from "../settings/secrets.js";

const TEXT_MAX_LENGTH = 2000;
const TEXTAREA_MAX_LENGTH = 20000;
const DISPLAY_NAME_MAX = 80;
const PERMISSION_SET = new Set<string>(PLUGIN_PERMISSIONS);
const PLUGIN_TYPE_SET = new Set<string>(PLUGIN_TYPES);
const LIFECYCLE_STATUSES = new Set<string>([
  "installed",
  "disabled",
  "enabled",
  "started",
  "error",
]);
const urlSchema = z.string().url();
const emailSchema = z.string().email();

type Db = FluxoDatabase["db"];
type InstanceKind = "service" | "gateway";

export type PluginPersistBlockCode = "instances_exist" | "enabled_instances_exist";

export interface PluginPersistBlock {
  code: PluginPersistBlockCode;
  message: string;
  pluginId: string;
  instanceCount: number;
  instanceIds: readonly string[];
}

export interface PluginInstallRow {
  id: string;
  type: PluginType;
  version: string;
  enabled: boolean;
  status: PluginLifecycleStatus;
  error: string | null;
  discoveredPath: string | null;
  contentHash: string | null;
  manifest: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginInstanceRow {
  id: string;
  pluginId: string;
  kind: InstanceKind;
  displayName: string;
  enabled: boolean;
  config: Record<string, JsonValue>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertInstallInput {
  id: string;
  type: PluginType;
  version: string;
  manifest: unknown;
  discoveredPath?: string | null;
  contentHash?: string | null;
  enabled?: boolean;
  status?: PluginLifecycleStatus;
  error?: string | null;
}

export interface CreateInstanceInput {
  pluginId: string;
  kind: InstanceKind;
  displayName: string;
  enabled?: boolean;
  config?: Record<string, JsonValue>;
  id?: string;
}

export interface UpdateInstanceInput {
  displayName?: string;
  enabled?: boolean;
  config?: Record<string, JsonValue>;
}

export interface ValidatedPluginConfig {
  values: Record<string, JsonValue>;
  secrets: Record<string, string>;
}

export interface PluginPersist {
  listInstalls(): Promise<PluginInstallRow[]>;
  getInstall(pluginId: string): Promise<PluginInstallRow | undefined>;
  upsertInstall(input: UpsertInstallInput): Promise<PluginInstallRow>;
  setEnabled(pluginId: string, enabled: boolean): Promise<PluginInstallRow>;
  recordFailure(pluginId: string, error: string): Promise<PluginInstallRow>;
  uninstall(pluginId: string, options?: { purgeStorage?: boolean }): Promise<void>;
  assertCanUninstall(pluginId: string): Promise<void>;
  assertCanDisable(pluginId: string): Promise<void>;
  listInstances(pluginId?: string): Promise<PluginInstanceRow[]>;
  getInstance(instanceId: string): Promise<PluginInstanceRow | undefined>;
  createInstance(input: CreateInstanceInput): Promise<PluginInstanceRow>;
  updateInstance(instanceId: string, input: UpdateInstanceInput): Promise<PluginInstanceRow>;
  setInstanceEnabled(instanceId: string, enabled: boolean): Promise<PluginInstanceRow>;
  deleteInstance(instanceId: string): Promise<void>;
  countInstances(pluginId: string): Promise<number>;
  getKv(pluginId: string, key: string): Promise<JsonValue | undefined>;
  setKv(pluginId: string, key: string, value: JsonValue): Promise<void>;
  deleteKv(pluginId: string, key: string): Promise<void>;
  listKvKeys(pluginId: string, prefix?: string): Promise<readonly string[]>;
  purgeKv(pluginId: string): Promise<void>;
  getSecret(pluginId: string, key: string, instanceId?: string): Promise<string | null>;
  setSecret(
    pluginId: string,
    key: string,
    value: string | null,
    instanceId?: string,
  ): Promise<void>;
  listSecretKeysSet(pluginId: string, instanceId?: string): Promise<readonly string[]>;
  purgeSecrets(pluginId: string): Promise<void>;
}

interface PersistAdapter {
  listInstalls(): Promise<PluginInstallRow[]>;
  getInstall(id: string): Promise<PluginInstallRow | undefined>;
  putInstall(row: PluginInstallRow): Promise<void>;
  deleteInstall(id: string): Promise<void>;
  listInstances(pluginId?: string): Promise<PluginInstanceRow[]>;
  getInstance(id: string): Promise<PluginInstanceRow | undefined>;
  putInstance(row: PluginInstanceRow): Promise<void>;
  deleteInstance(id: string): Promise<void>;
  getKv(pluginId: string, key: string): Promise<JsonValue | undefined>;
  putKv(pluginId: string, key: string, value: JsonValue, now: Date): Promise<void>;
  deleteKv(pluginId: string, key: string): Promise<void>;
  listKvKeys(pluginId: string): Promise<string[]>;
  deleteKvByPlugin(pluginId: string): Promise<void>;
  getSecretPayload(
    pluginId: string,
    instanceId: string,
    key: string,
  ): Promise<unknown | undefined>;
  putSecretPayload(
    pluginId: string,
    instanceId: string,
    key: string,
    payload: unknown,
    now: Date,
  ): Promise<void>;
  deleteSecret(pluginId: string, instanceId: string, key: string): Promise<void>;
  listSecretKeys(pluginId: string, instanceId: string): Promise<string[]>;
  deleteSecretsByPlugin(pluginId: string): Promise<void>;
  deleteSecretsByInstance(pluginId: string, instanceId: string): Promise<void>;
}

export function assertStorageKey(key: string): string {
  return assertStorageIdentifier(key, "key");
}

export function assertStorageCollection(collection: string): string {
  return assertStorageIdentifier(collection, "collection");
}

export function assertStorageIdentifier(
  value: string,
  label: "key" | "collection",
): string {
  if (!isSafeStorageKey(value) || isForbiddenObjectKey(value)) {
    throw new ForgeValidationError(`Invalid storage ${label}`);
  }
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  if (normalized.length === 0) {
    throw new ForgeValidationError(`Invalid storage ${label}`);
  }
  for (const segment of normalized.split("/")) {
    if (
      segment.length === 0 ||
      segment === "." ||
      isForbiddenObjectKey(segment)
    ) {
      throw new ForgeValidationError(`Invalid storage ${label}`);
    }
  }
  return value;
}

export function describeUninstallBlock(
  pluginId: string,
  instances: readonly { id: string }[],
): PluginPersistBlock | undefined {
  if (instances.length === 0) {
    return undefined;
  }
  const instanceIds = instances.map((instance) => instance.id);
  return {
    code: "instances_exist",
    message: `Cannot uninstall ${pluginId}: ${String(instances.length)} instance(s) still exist`,
    pluginId,
    instanceCount: instances.length,
    instanceIds,
  };
}

export function describeDisableBlock(
  pluginId: string,
  instances: readonly { id: string; enabled: boolean }[],
): PluginPersistBlock | undefined {
  const enabled = instances.filter((instance) => instance.enabled);
  if (enabled.length === 0) {
    return undefined;
  }
  const instanceIds = enabled.map((instance) => instance.id);
  return {
    code: "enabled_instances_exist",
    message: `Cannot disable ${pluginId}: ${String(enabled.length)} enabled instance(s) still exist`,
    pluginId,
    instanceCount: enabled.length,
    instanceIds,
  };
}

export function validatePluginConfig(
  schema: readonly PluginConfigField[],
  input: unknown,
): ValidatedPluginConfig {
  if (input === undefined || input === null) {
    throw new ForgeConfigError("Config must be an object");
  }
  assertNoPrototypePollution(input);
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new ForgeConfigError("Config must be an object");
  }

  const record = input as Record<string, unknown>;
  const allowed = new Set(schema.map((field) => field.key));
  for (const key of Object.keys(record)) {
    if (isForbiddenObjectKey(key)) {
      throw new ForgeConfigError(`Forbidden config key: ${key}`);
    }
    if (!allowed.has(key)) {
      throw new ForgeConfigError(`Unknown config key: ${key}`);
    }
  }

  const values: Record<string, JsonValue> = {};
  const secrets: Record<string, string> = {};

  for (const field of schema) {
    const provided = Object.hasOwn(record, field.key);
    const raw = provided ? record[field.key] : undefined;
    const resolved = resolveFieldValue(field, raw, provided);
    if (resolved === undefined) {
      continue;
    }
    if (field.type === "secret") {
      secrets[field.key] = resolved as string;
    } else {
      values[field.key] = resolved;
    }
  }

  return { values, secrets };
}

export function toPluginConfigPublic(
  values: Readonly<Record<string, JsonValue>>,
  secretKeysSet: readonly string[],
): PluginConfigPublic {
  const hidden = new Set(secretKeysSet);
  const publicValues: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(values)) {
    if (hidden.has(key) || isForbiddenObjectKey(key)) {
      continue;
    }
    publicValues[key] = value;
  }
  return {
    values: publicValues,
    secretKeysSet: [...secretKeysSet],
  };
}

export function toPluginDefinitionRecord(
  install: PluginInstallRow,
  instanceCount: number,
): PluginDefinitionRecord {
  const meta = readManifestMeta(install.manifest, install);
  const record: PluginDefinitionRecord = {
    id: install.id,
    type: install.type,
    name: meta.name,
    version: install.version,
    forgeApi: meta.forgeApi,
    permissions: meta.permissions,
    status: install.status,
    instanceCount,
  };
  if (meta.description !== undefined) {
    record.description = meta.description;
  }
  if (meta.author !== undefined) {
    record.author = meta.author;
  }
  if (install.error) {
    record.error = install.error;
  }
  return record;
}

export function toPluginInstanceRecord(
  instance: PluginInstanceRow,
  secretKeysSet: readonly string[],
): PluginInstanceRecord {
  return {
    id: instance.id,
    pluginId: instance.pluginId,
    kind: instance.kind,
    displayName: instance.displayName,
    enabled: instance.enabled,
    config: toPluginConfigPublic(instance.config, secretKeysSet),
  };
}

export function createPluginStorage(
  persist: Pick<PluginPersist, "getKv" | "setKv" | "deleteKv" | "listKvKeys">,
  pluginId: string,
): PluginStorage {
  const namespace = parsePluginId(pluginId);
  return {
    get: (key) => persist.getKv(namespace, key),
    set: (key, value) => persist.setKv(namespace, key, value),
    delete: (key) => persist.deleteKv(namespace, key),
    keys: (prefix) => persist.listKvKeys(namespace, prefix),
  };
}

export function createMemoryPluginPersist(options?: { appKey?: string }): PluginPersist {
  return createHostPluginPersist(createMemoryAdapter(), options?.appKey ?? "");
}

export function createPostgresPluginPersist(
  db: Db,
  options: { appKey: string },
): PluginPersist {
  return createHostPluginPersist(createPostgresAdapter(db), options.appKey);
}

function createHostPluginPersist(adapter: PersistAdapter, appKey: string): PluginPersist {
  return {
    listInstalls: () => adapter.listInstalls(),
    getInstall: (pluginId) => adapter.getInstall(parsePluginId(pluginId)),
    async upsertInstall(input) {
      const id = parsePluginId(input.id);
      if (!PLUGIN_TYPE_SET.has(input.type)) {
        throw new ForgeValidationError("Invalid plugin type");
      }
      assertNoPrototypePollution(input.manifest);
      if (input.status !== undefined && !LIFECYCLE_STATUSES.has(input.status)) {
        throw new ForgeValidationError("Invalid plugin status");
      }
      const existing = await adapter.getInstall(id);
      const now = new Date();
      const row: PluginInstallRow = {
        id,
        type: input.type,
        version: input.version,
        enabled: input.enabled ?? existing?.enabled ?? false,
        status:
          input.status ??
          existing?.status ??
          (input.enabled === true ? "enabled" : "installed"),
        error: input.error === undefined ? (existing?.error ?? null) : input.error,
        discoveredPath:
          input.discoveredPath === undefined
            ? (existing?.discoveredPath ?? null)
            : input.discoveredPath,
        contentHash:
          input.contentHash === undefined
            ? (existing?.contentHash ?? null)
            : input.contentHash,
        manifest: input.manifest,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await adapter.putInstall(row);
      return cloneInstall(row);
    },
    async setEnabled(pluginId, enabled) {
      const id = parsePluginId(pluginId);
      const existing = await requireInstall(adapter, id);
      if (!enabled) {
        throwIfBlocked(describeDisableBlock(id, await adapter.listInstances(id)));
      }
      const now = new Date();
      const row: PluginInstallRow = {
        ...existing,
        enabled,
        status: enabled ? "enabled" : "disabled",
        error: existing.error,
        updatedAt: now,
      };
      await adapter.putInstall(row);
      return cloneInstall(row);
    },
    async recordFailure(pluginId, error) {
      const id = parsePluginId(pluginId);
      const existing = await requireInstall(adapter, id);
      const row: PluginInstallRow = {
        ...existing,
        status: "error",
        error,
        updatedAt: new Date(),
      };
      await adapter.putInstall(row);
      return cloneInstall(row);
    },
    async uninstall(pluginId, options) {
      const id = parsePluginId(pluginId);
      await requireInstall(adapter, id);
      throwIfBlocked(describeUninstallBlock(id, await adapter.listInstances(id)));
      await adapter.deleteInstall(id);
      if (options?.purgeStorage === true) {
        await adapter.deleteKvByPlugin(id);
        await adapter.deleteSecretsByPlugin(id);
      }
    },
    async assertCanUninstall(pluginId) {
      const id = parsePluginId(pluginId);
      await requireInstall(adapter, id);
      throwIfBlocked(describeUninstallBlock(id, await adapter.listInstances(id)));
    },
    async assertCanDisable(pluginId) {
      const id = parsePluginId(pluginId);
      await requireInstall(adapter, id);
      throwIfBlocked(describeDisableBlock(id, await adapter.listInstances(id)));
    },
    listInstances: (pluginId) =>
      adapter.listInstances(pluginId === undefined ? undefined : parsePluginId(pluginId)),
    getInstance: (instanceId) => adapter.getInstance(parseInstanceId(instanceId)),
    async createInstance(input) {
      const pluginId = parsePluginId(input.pluginId);
      const install = await requireInstall(adapter, pluginId);
      const kind = parseInstanceKind(input.kind);
      if (install.type === "panel") {
        throw new ForgeValidationError("Panel plugins do not have instances");
      }
      if (install.type !== kind) {
        throw new ForgeValidationError("Instance kind must match plugin type");
      }
      const displayName = parseDisplayName(input.displayName);
      const config = parseConfigRecord(input.config ?? {});
      const now = new Date();
      const row: PluginInstanceRow = {
        id: input.id === undefined ? crypto.randomUUID() : parseInstanceId(input.id),
        pluginId,
        kind,
        displayName,
        enabled: input.enabled ?? false,
        config,
        createdAt: now,
        updatedAt: now,
      };
      await adapter.putInstance(row);
      return cloneInstance(row);
    },
    async updateInstance(instanceId, input) {
      const id = parseInstanceId(instanceId);
      const existing = await requireInstance(adapter, id);
      const now = new Date();
      const row: PluginInstanceRow = {
        ...existing,
        displayName:
          input.displayName === undefined
            ? existing.displayName
            : parseDisplayName(input.displayName),
        enabled: input.enabled ?? existing.enabled,
        config:
          input.config === undefined ? existing.config : parseConfigRecord(input.config),
        updatedAt: now,
      };
      await adapter.putInstance(row);
      return cloneInstance(row);
    },
    async setInstanceEnabled(instanceId, enabled) {
      const id = parseInstanceId(instanceId);
      const existing = await requireInstance(adapter, id);
      const row: PluginInstanceRow = {
        ...existing,
        enabled,
        updatedAt: new Date(),
      };
      await adapter.putInstance(row);
      return cloneInstance(row);
    },
    async deleteInstance(instanceId) {
      const id = parseInstanceId(instanceId);
      const existing = await requireInstance(adapter, id);
      await adapter.deleteSecretsByInstance(existing.pluginId, existing.id);
      await adapter.deleteInstance(existing.id);
    },
    async countInstances(pluginId) {
      const id = parsePluginId(pluginId);
      const instances = await adapter.listInstances(id);
      return instances.length;
    },
    async getKv(pluginId, key) {
      const id = parsePluginId(pluginId);
      assertStorageKey(key);
      return adapter.getKv(id, key);
    },
    async setKv(pluginId, key, value) {
      const id = parsePluginId(pluginId);
      assertStorageKey(key);
      const parsed = parseJsonValue(value);
      await adapter.putKv(id, key, parsed, new Date());
    },
    async deleteKv(pluginId, key) {
      const id = parsePluginId(pluginId);
      assertStorageKey(key);
      await adapter.deleteKv(id, key);
    },
    async listKvKeys(pluginId, prefix) {
      const id = parsePluginId(pluginId);
      if (prefix !== undefined) {
        assertStorageKey(prefix);
      }
      const keys = await adapter.listKvKeys(id);
      if (prefix === undefined) {
        return keys;
      }
      return keys.filter((key) => key.startsWith(prefix));
    },
    async purgeKv(pluginId) {
      await adapter.deleteKvByPlugin(parsePluginId(pluginId));
    },
    async getSecret(pluginId, key, instanceId) {
      const id = parsePluginId(pluginId);
      assertStorageKey(key);
      const scope = parseSecretScope(instanceId);
      const payload = await adapter.getSecretPayload(id, scope, key);
      if (payload === undefined) {
        return null;
      }
      return openSecret(payload, appKey);
    },
    async setSecret(pluginId, key, value, instanceId) {
      const id = parsePluginId(pluginId);
      assertStorageKey(key);
      const scope = parseSecretScope(instanceId);
      if (value === null) {
        await adapter.deleteSecret(id, scope, key);
        return;
      }
      const sealed = sealSecret(value, appKey);
      await adapter.putSecretPayload(id, scope, key, sealed, new Date());
    },
    async listSecretKeysSet(pluginId, instanceId) {
      const id = parsePluginId(pluginId);
      const scope = parseSecretScope(instanceId);
      return adapter.listSecretKeys(id, scope);
    },
    async purgeSecrets(pluginId) {
      await adapter.deleteSecretsByPlugin(parsePluginId(pluginId));
    },
  };
}

function createMemoryAdapter(): PersistAdapter {
  const installs = new Map<string, PluginInstallRow>();
  const instances = new Map<string, PluginInstanceRow>();
  const kv = new Map<string, JsonValue>();
  const secrets = new Map<string, unknown>();

  return {
    async listInstalls() {
      return [...installs.values()].map(cloneInstall);
    },
    async getInstall(id) {
      const row = installs.get(id);
      return row === undefined ? undefined : cloneInstall(row);
    },
    async putInstall(row) {
      installs.set(row.id, cloneInstall(row));
    },
    async deleteInstall(id) {
      installs.delete(id);
    },
    async listInstances(pluginId) {
      const rows = [...instances.values()].filter(
        (row) => pluginId === undefined || row.pluginId === pluginId,
      );
      return rows.map(cloneInstance);
    },
    async getInstance(id) {
      const row = instances.get(id);
      return row === undefined ? undefined : cloneInstance(row);
    },
    async putInstance(row) {
      instances.set(row.id, cloneInstance(row));
    },
    async deleteInstance(id) {
      instances.delete(id);
    },
    async getKv(pluginId, key) {
      const value = kv.get(kvSlot(pluginId, key));
      return value === undefined ? undefined : structuredClone(value);
    },
    async putKv(pluginId, key, value) {
      kv.set(kvSlot(pluginId, key), structuredClone(value));
    },
    async deleteKv(pluginId, key) {
      kv.delete(kvSlot(pluginId, key));
    },
    async listKvKeys(pluginId) {
      const prefix = `${pluginId}\0`;
      const keys: string[] = [];
      for (const slot of kv.keys()) {
        if (slot.startsWith(prefix)) {
          keys.push(slot.slice(prefix.length));
        }
      }
      return keys;
    },
    async deleteKvByPlugin(pluginId) {
      const prefix = `${pluginId}\0`;
      for (const slot of [...kv.keys()]) {
        if (slot.startsWith(prefix)) {
          kv.delete(slot);
        }
      }
    },
    async getSecretPayload(pluginId, instanceId, key) {
      return secrets.get(secretSlot(pluginId, instanceId, key));
    },
    async putSecretPayload(pluginId, instanceId, key, payload) {
      secrets.set(secretSlot(pluginId, instanceId, key), payload);
    },
    async deleteSecret(pluginId, instanceId, key) {
      secrets.delete(secretSlot(pluginId, instanceId, key));
    },
    async listSecretKeys(pluginId, instanceId) {
      const prefix = `${pluginId}\0${instanceId}\0`;
      const keys: string[] = [];
      for (const slot of secrets.keys()) {
        if (slot.startsWith(prefix)) {
          keys.push(slot.slice(prefix.length));
        }
      }
      return keys;
    },
    async deleteSecretsByPlugin(pluginId) {
      const prefix = `${pluginId}\0`;
      for (const slot of [...secrets.keys()]) {
        if (slot.startsWith(prefix)) {
          secrets.delete(slot);
        }
      }
    },
    async deleteSecretsByInstance(pluginId, instanceId) {
      const prefix = `${pluginId}\0${instanceId}\0`;
      for (const slot of [...secrets.keys()]) {
        if (slot.startsWith(prefix)) {
          secrets.delete(slot);
        }
      }
    },
  };
}

function createPostgresAdapter(db: Db): PersistAdapter {
  return {
    async listInstalls() {
      const rows = await db.select().from(pluginInstalls);
      return rows.map(mapInstallRow);
    },
    async getInstall(id) {
      const rows = await db
        .select()
        .from(pluginInstalls)
        .where(eq(pluginInstalls.id, id))
        .limit(1);
      return rows[0] === undefined ? undefined : mapInstallRow(rows[0]);
    },
    async putInstall(row) {
      await db
        .insert(pluginInstalls)
        .values({
          id: row.id,
          type: row.type,
          version: row.version,
          enabled: row.enabled,
          status: row.status,
          error: row.error,
          discoveredPath: row.discoveredPath,
          contentHash: row.contentHash,
          manifest: row.manifest,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
        .onConflictDoUpdate({
          target: pluginInstalls.id,
          set: {
            type: row.type,
            version: row.version,
            enabled: row.enabled,
            status: row.status,
            error: row.error,
            discoveredPath: row.discoveredPath,
            contentHash: row.contentHash,
            manifest: row.manifest,
            updatedAt: row.updatedAt,
          },
        });
    },
    async deleteInstall(id) {
      await db.delete(pluginInstalls).where(eq(pluginInstalls.id, id));
    },
    async listInstances(pluginId) {
      const rows =
        pluginId === undefined
          ? await db.select().from(pluginInstances)
          : await db
              .select()
              .from(pluginInstances)
              .where(eq(pluginInstances.pluginId, pluginId));
      return rows.map(mapInstanceRow);
    },
    async getInstance(id) {
      const rows = await db
        .select()
        .from(pluginInstances)
        .where(eq(pluginInstances.id, id))
        .limit(1);
      return rows[0] === undefined ? undefined : mapInstanceRow(rows[0]);
    },
    async putInstance(row) {
      await db
        .insert(pluginInstances)
        .values({
          id: row.id,
          pluginId: row.pluginId,
          kind: row.kind,
          displayName: row.displayName,
          enabled: row.enabled,
          config: row.config,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        })
        .onConflictDoUpdate({
          target: pluginInstances.id,
          set: {
            pluginId: row.pluginId,
            kind: row.kind,
            displayName: row.displayName,
            enabled: row.enabled,
            config: row.config,
            updatedAt: row.updatedAt,
          },
        });
    },
    async deleteInstance(id) {
      await db.delete(pluginInstances).where(eq(pluginInstances.id, id));
    },
    async getKv(pluginId, key) {
      const rows = await db
        .select()
        .from(pluginKv)
        .where(and(eq(pluginKv.pluginId, pluginId), eq(pluginKv.key, key)))
        .limit(1);
      if (rows[0] === undefined) {
        return undefined;
      }
      const parsed = jsonValueSchema.safeParse(rows[0].value);
      return parsed.success ? parsed.data : undefined;
    },
    async putKv(pluginId, key, value, now) {
      await db
        .insert(pluginKv)
        .values({
          pluginId,
          key,
          value,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [pluginKv.pluginId, pluginKv.key],
          set: { value, updatedAt: now },
        });
    },
    async deleteKv(pluginId, key) {
      await db
        .delete(pluginKv)
        .where(and(eq(pluginKv.pluginId, pluginId), eq(pluginKv.key, key)));
    },
    async listKvKeys(pluginId) {
      const rows = await db
        .select({ key: pluginKv.key })
        .from(pluginKv)
        .where(eq(pluginKv.pluginId, pluginId));
      return rows.map((row) => row.key);
    },
    async deleteKvByPlugin(pluginId) {
      await db.delete(pluginKv).where(eq(pluginKv.pluginId, pluginId));
    },
    async getSecretPayload(pluginId, instanceId, key) {
      const rows = await db
        .select()
        .from(pluginSecrets)
        .where(
          and(
            eq(pluginSecrets.pluginId, pluginId),
            eq(pluginSecrets.instanceId, instanceId),
            eq(pluginSecrets.key, key),
          ),
        )
        .limit(1);
      return rows[0]?.payload;
    },
    async putSecretPayload(pluginId, instanceId, key, payload, now) {
      await db
        .insert(pluginSecrets)
        .values({
          pluginId,
          instanceId,
          key,
          payload,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [pluginSecrets.pluginId, pluginSecrets.instanceId, pluginSecrets.key],
          set: { payload, updatedAt: now },
        });
    },
    async deleteSecret(pluginId, instanceId, key) {
      await db
        .delete(pluginSecrets)
        .where(
          and(
            eq(pluginSecrets.pluginId, pluginId),
            eq(pluginSecrets.instanceId, instanceId),
            eq(pluginSecrets.key, key),
          ),
        );
    },
    async listSecretKeys(pluginId, instanceId) {
      const rows = await db
        .select({ key: pluginSecrets.key })
        .from(pluginSecrets)
        .where(
          and(
            eq(pluginSecrets.pluginId, pluginId),
            eq(pluginSecrets.instanceId, instanceId),
          ),
        );
      return rows.map((row) => row.key);
    },
    async deleteSecretsByPlugin(pluginId) {
      await db.delete(pluginSecrets).where(eq(pluginSecrets.pluginId, pluginId));
    },
    async deleteSecretsByInstance(pluginId, instanceId) {
      await db
        .delete(pluginSecrets)
        .where(
          and(
            eq(pluginSecrets.pluginId, pluginId),
            eq(pluginSecrets.instanceId, instanceId),
          ),
        );
    },
  };
}

function resolveFieldValue(
  field: PluginConfigField,
  raw: unknown,
  provided: boolean,
): JsonValue | undefined {
  if (!provided || raw === undefined) {
    if (field.required === true && field.type !== "boolean" && !("default" in field)) {
      throw new ForgeConfigError(`Missing required config field: ${field.key}`);
    }
    if (field.type === "secret") {
      if (field.required === true) {
        throw new ForgeConfigError(`Missing required config field: ${field.key}`);
      }
      return undefined;
    }
    if ("default" in field && field.default !== undefined) {
      return validateTypedValue(field, field.default);
    }
    if (field.required === true) {
      throw new ForgeConfigError(`Missing required config field: ${field.key}`);
    }
    return undefined;
  }
  if (field.type === "secret") {
    if (typeof raw !== "string" || raw.length === 0) {
      if (field.required === true) {
        throw new ForgeConfigError(`Missing required config field: ${field.key}`);
      }
      return undefined;
    }
    return raw;
  }
  return validateTypedValue(field, raw);
}

function validateTypedValue(field: PluginConfigField, raw: unknown): JsonValue {
  switch (field.type) {
    case "text":
      return validateText(field.key, raw, field.minLength, field.maxLength ?? TEXT_MAX_LENGTH);
    case "textarea":
      return validateText(field.key, raw, undefined, field.maxLength ?? TEXTAREA_MAX_LENGTH);
    case "number":
      return validateNumber(field, raw);
    case "boolean":
      if (raw !== true && raw !== false) {
        throw new ForgeConfigError(`Invalid type for ${field.key}: expected boolean`);
      }
      return raw;
    case "url": {
      if (typeof raw !== "string") {
        throw new ForgeConfigError(`Invalid type for ${field.key}: expected url`);
      }
      const parsed = urlSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ForgeConfigError(`Invalid url for ${field.key}`);
      }
      return parsed.data;
    }
    case "email": {
      if (typeof raw !== "string") {
        throw new ForgeConfigError(`Invalid type for ${field.key}: expected email`);
      }
      const parsed = emailSchema.safeParse(raw);
      if (!parsed.success) {
        throw new ForgeConfigError(`Invalid email for ${field.key}`);
      }
      return parsed.data;
    }
    case "select": {
      if (typeof raw !== "string") {
        throw new ForgeConfigError(`Invalid type for ${field.key}: expected string`);
      }
      if (!field.options.some((option) => option.value === raw)) {
        throw new ForgeConfigError(`Invalid option for ${field.key}`);
      }
      return raw;
    }
    case "multiselect": {
      if (!Array.isArray(raw) || raw.some((item) => typeof item !== "string")) {
        throw new ForgeConfigError(`Invalid type for ${field.key}: expected string[]`);
      }
      const values = raw as string[];
      const allowed = new Set(field.options.map((option) => option.value));
      const seen = new Set<string>();
      for (const value of values) {
        if (!allowed.has(value)) {
          throw new ForgeConfigError(`Invalid option for ${field.key}`);
        }
        if (seen.has(value)) {
          throw new ForgeConfigError(`Duplicate option for ${field.key}`);
        }
        seen.add(value);
      }
      return values;
    }
    case "secret":
      if (typeof raw !== "string") {
        throw new ForgeConfigError(`Invalid type for ${field.key}: expected secret`);
      }
      return raw;
    default:
      throw new ForgeConfigError(`Unsupported config field type`);
  }
}

function validateText(
  key: string,
  raw: unknown,
  minLength: number | undefined,
  maxLength: number,
): string {
  if (typeof raw !== "string") {
    throw new ForgeConfigError(`Invalid type for ${key}: expected string`);
  }
  if (raw.length > maxLength) {
    throw new ForgeConfigError(`Invalid length for ${key}`);
  }
  if (minLength !== undefined && raw.length < minLength) {
    throw new ForgeConfigError(`Invalid length for ${key}`);
  }
  return raw;
}

function validateNumber(field: Extract<PluginConfigField, { type: "number" }>, raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw new ForgeConfigError(`Invalid type for ${field.key}: expected number`);
  }
  if (field.integer === true && !Number.isInteger(raw)) {
    throw new ForgeConfigError(`Invalid number for ${field.key}: expected integer`);
  }
  if (field.min !== undefined && raw < field.min) {
    throw new ForgeConfigError(`Invalid number for ${field.key}`);
  }
  if (field.max !== undefined && raw > field.max) {
    throw new ForgeConfigError(`Invalid number for ${field.key}`);
  }
  return raw;
}

function parseJsonValue(value: unknown): JsonValue {
  assertNoPrototypePollution(value);
  const parsed = jsonValueSchema.safeParse(value);
  if (!parsed.success) {
    throw new ForgeValidationError("Invalid storage value");
  }
  return parsed.data;
}

function parseConfigRecord(value: Record<string, JsonValue>): Record<string, JsonValue> {
  assertNoPrototypePollution(value);
  const result: Record<string, JsonValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (isForbiddenObjectKey(key)) {
      throw new ForgeValidationError(`Forbidden config key: ${key}`);
    }
    result[key] = parseJsonValue(entry);
  }
  return result;
}

function parseInstanceKind(value: string): InstanceKind {
  if (value !== "service" && value !== "gateway") {
    throw new ForgeValidationError("Invalid instance kind");
  }
  return value;
}

function parseDisplayName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > DISPLAY_NAME_MAX) {
    throw new ForgeValidationError("Invalid instance display name");
  }
  return trimmed;
}

function parseSecretScope(instanceId: string | undefined): string {
  if (instanceId === undefined || instanceId.length === 0) {
    return "";
  }
  return parseInstanceId(instanceId);
}

function parseJsonValueRecord(value: unknown): Record<string, JsonValue> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }
  try {
    assertNoPrototypePollution(value);
  } catch {
    return {};
  }
  const result: Record<string, JsonValue> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isForbiddenObjectKey(key)) {
      continue;
    }
    const parsed = jsonValueSchema.safeParse(entry);
    if (parsed.success) {
      result[key] = parsed.data;
    }
  }
  return result;
}

function readManifestMeta(
  manifest: unknown,
  install: PluginInstallRow,
): {
  name: string;
  forgeApi: string;
  description?: string;
  author?: string;
  permissions: PluginPermission[];
} {
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return { name: install.id, forgeApi: "", permissions: [] };
  }
  const record = manifest as Record<string, unknown>;
  const name = typeof record.name === "string" && record.name.length > 0 ? record.name : install.id;
  const forgeApi = typeof record.forgeApi === "string" ? record.forgeApi : "";
  const description =
    typeof record.description === "string" && record.description.length > 0
      ? record.description
      : undefined;
  const author =
    typeof record.author === "string" && record.author.length > 0 ? record.author : undefined;
  const permissions: PluginPermission[] = [];
  if (Array.isArray(record.permissions)) {
    for (const item of record.permissions) {
      if (typeof item === "string" && PERMISSION_SET.has(item)) {
        permissions.push(item as PluginPermission);
      }
    }
  }
  return { name, forgeApi, description, author, permissions };
}

function mapInstallRow(row: typeof pluginInstalls.$inferSelect): PluginInstallRow {
  return {
    id: row.id,
    type: row.type,
    version: row.version,
    enabled: row.enabled,
    status: row.status,
    error: row.error,
    discoveredPath: row.discoveredPath,
    contentHash: row.contentHash,
    manifest: row.manifest,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapInstanceRow(row: typeof pluginInstances.$inferSelect): PluginInstanceRow {
  return {
    id: row.id,
    pluginId: row.pluginId,
    kind: row.kind,
    displayName: row.displayName,
    enabled: row.enabled,
    config: parseJsonValueRecord(row.config),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function cloneInstall(row: PluginInstallRow): PluginInstallRow {
  return {
    ...row,
    manifest: structuredClone(row.manifest),
  };
}

function cloneInstance(row: PluginInstanceRow): PluginInstanceRow {
  return {
    ...row,
    config: { ...row.config },
  };
}

async function requireInstall(
  adapter: PersistAdapter,
  pluginId: string,
): Promise<PluginInstallRow> {
  const row = await adapter.getInstall(pluginId);
  if (row === undefined) {
    throw new ForgeNotFoundError(`plugin ${pluginId}`);
  }
  return row;
}

async function requireInstance(
  adapter: PersistAdapter,
  instanceId: string,
): Promise<PluginInstanceRow> {
  const row = await adapter.getInstance(instanceId);
  if (row === undefined) {
    throw new ForgeNotFoundError(`plugin instance ${instanceId}`);
  }
  return row;
}

function throwIfBlocked(block: PluginPersistBlock | undefined): void {
  if (block) {
    throw new ForgeConflictError(block.message);
  }
}

function kvSlot(pluginId: string, key: string): string {
  return `${pluginId}\0${key}`;
}

function secretSlot(pluginId: string, instanceId: string, key: string): string {
  return `${pluginId}\0${instanceId}\0${key}`;
}

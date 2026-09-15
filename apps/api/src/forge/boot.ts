import type { FluxoDatabase } from "@fluxo/db";
import type { PluginLogger } from "@fluxo/forge";
import type { UserStore } from "../auth/stores/types.js";
import type { SettingsRuntime } from "../settings/runtime.js";
import { setActiveForgeEventBus } from "./events.js";
import { createForgeHost, type ForgeHost } from "./host.js";
import {
  createMemoryPluginPersist,
  createPostgresPluginPersist,
  type PluginPersist,
} from "./persist.js";

export type { ForgeHost } from "./host.js";

export interface StartForgeOptions {
  logger: PluginLogger;
  pluginsDir: string;
  persist?: PluginPersist;
  database?: FluxoDatabase;
  appKey?: string;
  httpAllowlist?: readonly string[];
  users?: Pick<UserStore, "findById">;
  settings?: Pick<SettingsRuntime, "current">;
}

let host: ForgeHost | undefined;

export function getForgeHost(): ForgeHost {
  if (host === undefined) {
    throw new Error("Forge host is not started");
  }
  return host;
}

export async function startForge(options: StartForgeOptions): Promise<ForgeHost> {
  if (host !== undefined) {
    await stopForge();
  }

  const persist = resolvePersist(options);
  const loadFromDisk = persist !== undefined;
  const resolvedPersist = persist ?? createMemoryPluginPersist();

  const next = createForgeHost({
    persist: resolvedPersist,
    logger: options.logger,
    pluginsDir: options.pluginsDir,
    httpAllowlist: options.httpAllowlist ?? [],
    users: options.users,
    settings: options.settings,
  });
  setActiveForgeEventBus(next.events);
  host = next;

  if (!loadFromDisk) {
    options.logger.warn("forge plugins skipped: database is not ready");
    return next;
  }

  try {
    const results = await next.manager.loadAll();
    for (const result of results) {
      if (!result.ok) {
        options.logger.error("plugin failed to load", {
          pluginId: result.id,
          error: result.error,
        });
      }
    }
  } catch (error) {
    options.logger.error("forge loadAll failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return next;
}

export async function stopForge(): Promise<void> {
  const current = host;
  host = undefined;
  setActiveForgeEventBus(undefined);
  if (current === undefined) {
    return;
  }
  await current.jobs.stopAll().catch(() => undefined);
  await current.manager.stopAll().catch(() => undefined);
}

function resolvePersist(options: StartForgeOptions): PluginPersist | undefined {
  if (options.persist) {
    return options.persist;
  }
  if (!options.database) {
    return undefined;
  }
  try {
    return createPostgresPluginPersist(options.database.db, {
      appKey: options.appKey ?? "",
    });
  } catch {
    return undefined;
  }
}

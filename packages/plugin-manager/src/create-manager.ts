import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { FluxoPlugin, PluginContext } from "@fluxo/forge";
import { PluginStatus, type PluginState } from "@fluxo/types";
import { PluginNotFoundError, PluginNotLoadableError } from "./errors.js";
import { fallbackManifest, formatManifestError, pluginManifestSchema } from "./manifest.js";
import type { PluginLoadResult, PluginManager, PluginManagerOptions } from "./types.js";

interface PluginEntry {
  filePath: string;
  plugin: FluxoPlugin | undefined;
  state: PluginState;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function isPluginShape(value: unknown): value is FluxoPlugin {
  return typeof value === "object" && value !== null && "manifest" in value;
}

function resolveFallbackId(filePath: string, rawManifest: unknown): string {
  if (
    typeof rawManifest === "object" &&
    rawManifest !== null &&
    "id" in rawManifest &&
    typeof rawManifest.id === "string" &&
    rawManifest.id.length > 0
  ) {
    return rawManifest.id;
  }

  return path.parse(filePath).name;
}

export function createPluginManager(options: PluginManagerOptions): PluginManager {
  const entries = new Map<string, PluginEntry>();
  const config = options.config ?? {};

  function context(id: string): PluginContext {
    return {
      logger: options.logger.child({ plugin: id }),
      config,
    } as unknown as PluginContext;
  }

  function snapshot(state: PluginState): PluginState {
    return { ...state, manifest: { ...state.manifest } };
  }

  function remember(entry: PluginEntry): PluginLoadResult {
    entries.set(entry.state.id, entry);
    return {
      id: entry.state.id,
      ok: entry.state.status !== PluginStatus.Error,
      ...(entry.state.error ? { error: entry.state.error } : {}),
      state: snapshot(entry.state),
    };
  }

  async function safeHook(
    plugin: FluxoPlugin | undefined,
    hook: "onLoad" | "onEnable" | "onDisable" | "onUnload",
    id: string,
  ): Promise<string | undefined> {
    if (!plugin) {
      return undefined;
    }

    try {
      await plugin[hook]?.(context(id));
      return undefined;
    } catch (error) {
      const message = errorMessage(error);
      options.logger.error(`plugin ${hook} failed`, { id, error: message });
      return message;
    }
  }

  async function loadFile(filePath: string): Promise<PluginLoadResult> {
    const fileId = path.parse(filePath).name;

    try {
      const href = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
      const module = (await import(href)) as { default?: unknown };
      const exported = module.default;

      if (!isPluginShape(exported)) {
        const id = fileId;
        const message = "plugin module must export default from definePlugin";
        return remember({
          filePath,
          plugin: undefined,
          state: {
            id,
            manifest: fallbackManifest(id, undefined),
            status: PluginStatus.Error,
            error: message,
          },
        });
      }

      const parsed = pluginManifestSchema.safeParse(exported.manifest);
      if (!parsed.success) {
        const id = resolveFallbackId(filePath, exported.manifest);
        const message = formatManifestError(parsed.error);
        return remember({
          filePath,
          plugin: undefined,
          state: {
            id,
            manifest: fallbackManifest(id, exported.manifest),
            status: PluginStatus.Error,
            error: message,
          },
        });
      }

      const manifest = parsed.data;
      if (entries.has(manifest.id)) {
        const message = `duplicate plugin id: ${manifest.id}`;
        return {
          id: manifest.id,
          ok: false,
          error: message,
          state: {
            id: manifest.id,
            manifest,
            status: PluginStatus.Error,
            error: message,
          },
        };
      }

      const loadError = await safeHook(exported, "onLoad", manifest.id);
      return remember({
        filePath,
        plugin: exported,
        state: {
          id: manifest.id,
          manifest,
          status: loadError ? PluginStatus.Error : PluginStatus.Loaded,
          ...(loadError ? { error: loadError } : {}),
        },
      });
    } catch (error) {
      const message = errorMessage(error);
      options.logger.error("plugin import failed", { id: fileId, error: message });
      return remember({
        filePath,
        plugin: undefined,
        state: {
          id: fileId,
          manifest: fallbackManifest(fileId, undefined),
          status: PluginStatus.Error,
          error: message,
        },
      });
    }
  }

  async function loadAll(): Promise<PluginLoadResult[]> {
    const dirents = await readdir(options.directory, { withFileTypes: true });
    const results: PluginLoadResult[] = [];

    for (const dirent of dirents) {
      if (!dirent.isFile() || !dirent.name.endsWith(".js") || dirent.name.endsWith(".test.js")) {
        continue;
      }

      const filePath = path.join(options.directory, dirent.name);
      const alreadyLoaded = [...entries.values()].some((entry) => entry.filePath === filePath);
      if (alreadyLoaded) {
        continue;
      }

      results.push(await loadFile(filePath));
    }

    return results;
  }

  async function unload(entry: PluginEntry): Promise<void> {
    if (entry.state.status === PluginStatus.Enabled) {
      await safeHook(entry.plugin, "onDisable", entry.state.id);
    }
    await safeHook(entry.plugin, "onUnload", entry.state.id);
  }

  async function enable(id: string): Promise<void> {
    const entry = entries.get(id);
    if (!entry) {
      throw new PluginNotFoundError(id);
    }

    if (entry.state.status === PluginStatus.Enabled) {
      return;
    }

    if (!entry.plugin) {
      throw new PluginNotLoadableError(id);
    }

    if (entry.state.status === PluginStatus.Error) {
      return;
    }

    const hookError = await safeHook(entry.plugin, "onEnable", id);
    entry.state = hookError
      ? { ...entry.state, status: PluginStatus.Error, error: hookError }
      : { id: entry.state.id, manifest: entry.state.manifest, status: PluginStatus.Enabled };
  }

  async function disable(id: string): Promise<void> {
    const entry = entries.get(id);
    if (!entry) {
      throw new PluginNotFoundError(id);
    }

    if (entry.state.status === PluginStatus.Disabled) {
      return;
    }

    if (!entry.plugin) {
      throw new PluginNotLoadableError(id);
    }

    const hookError = await safeHook(entry.plugin, "onDisable", id);
    entry.state = hookError
      ? { ...entry.state, status: PluginStatus.Error, error: hookError }
      : { id: entry.state.id, manifest: entry.state.manifest, status: PluginStatus.Disabled };
  }

  async function refresh(id?: string): Promise<void> {
    if (id === undefined) {
      const current = [...entries.values()];
      for (const entry of current) {
        await unload(entry);
      }
      entries.clear();
      await loadAll();
      return;
    }

    const entry = entries.get(id);
    if (!entry) {
      throw new PluginNotFoundError(id);
    }

    const filePath = entry.filePath;
    await unload(entry);
    entries.delete(id);
    await loadFile(filePath);
  }

  function list(): readonly PluginState[] {
    return [...entries.values()].map((entry) => snapshot(entry.state));
  }

  return { loadAll, enable, disable, refresh, list };
}

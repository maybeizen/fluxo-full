import { readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  FORGE_API_VERSION,
  ForgeConflictError,
  ForgeUnsupportedApiError,
  forgeApiSatisfied,
  parsePluginId,
  parsePluginManifest,
  type FluxoPlugin,
  type PluginContext,
  type PluginDefinition,
  type PluginId,
  type PluginLifecycleStatus,
  type PluginManifest,
} from "@fluxo/forge";
import { PluginNotFoundError, PluginNotLoadableError } from "./errors.js";
import {
  assertSafePluginIdInput,
  resolvePluginDirectory,
  resolvePluginEntryFile,
} from "./paths.js";
import type {
  PluginInstallState,
  PluginLoadResult,
  PluginManager,
  PluginManagerOptions,
} from "./types.js";

interface PluginEntry {
  id: PluginId;
  pluginRoot: string;
  manifest: PluginManifest;
  plugin: FluxoPlugin | undefined;
  status: PluginLifecycleStatus;
  error?: string;
  installed: boolean;
  enabled: boolean;
  started: boolean;
}

interface Candidate {
  pluginRoot: string;
  id: PluginId;
  manifest: PluginManifest;
}

export const PLUGIN_HOOK_TIMEOUT_MS = 15_000;

export function pluginImportHref(entryFile: string, cacheBust: boolean): string {
  const href = pathToFileURL(entryFile).href;
  if (!cacheBust) {
    return href;
  }
  return `${href}?t=${Date.now()}`;
}

type ManagerHook =
  "onInstall" | "onEnable" | "onStart" | "onStop" | "onDisable" | "onUninstall";

const DEFAULT_INSTALL_STATE: PluginInstallState = {
  installed: false,
  enabled: false,
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function isEnoent(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function isPluginShape(value: unknown): value is FluxoPlugin {
  return typeof value === "object" && value !== null && "manifest" in value;
}

function exportedPluginId(plugin: FluxoPlugin): string | undefined {
  const manifest = plugin.manifest as { id?: unknown } | undefined;
  return typeof manifest?.id === "string" ? manifest.id : undefined;
}

function toDefinition(entry: PluginEntry): PluginDefinition {
  return {
    id: entry.id,
    type: entry.manifest.type,
    manifest: { ...entry.manifest },
    status: entry.status,
    ...(entry.error ? { error: entry.error } : {}),
  };
}

function loadResult(entry: PluginEntry): PluginLoadResult {
  return {
    id: entry.id,
    ok: entry.status !== "error",
    ...(entry.error ? { error: entry.error } : {}),
    definition: toDefinition(entry),
  };
}

function failedResult(id: string, error: string): PluginLoadResult {
  return { id, ok: false, error };
}

function isErrorEntry(entry: PluginEntry): boolean {
  return entry.status === "error";
}

function resolveHook(
  plugin: FluxoPlugin,
  hook: ManagerHook,
): ((ctx: PluginContext) => Promise<void> | void) | undefined {
  if (hook === "onStart") {
    return plugin.onStart ?? plugin.onLoad;
  }
  if (hook === "onStop") {
    return plugin.onStop ?? plugin.onUnload;
  }
  return plugin[hook];
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const text = await readFile(filePath, "utf8");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Malformed plugin.json");
  }
}

async function assertManifestInsideRoot(
  pluginRoot: string,
  manifestPath: string,
): Promise<void> {
  const rootReal = await realpath(pluginRoot);
  const manifestReal = await realpath(manifestPath);
  const relative = path.relative(rootReal, manifestReal);
  if (relative !== "plugin.json" || path.isAbsolute(relative)) {
    throw new Error("plugin.json must live inside the plugin root");
  }
}

export function createPluginManager(
  options: PluginManagerOptions,
): PluginManager {
  const entries = new Map<string, PluginEntry>();
  const installOverlay = new Map<string, PluginInstallState>();

  async function resolveInstallState(
    pluginId: PluginId,
  ): Promise<PluginInstallState> {
    const overlay = installOverlay.get(pluginId);
    if (overlay) {
      return { ...overlay };
    }
    if (!options.getInstallState) {
      return { ...DEFAULT_INSTALL_STATE };
    }
    const resolved = await options.getInstallState(pluginId);
    const state = { ...resolved };
    installOverlay.set(pluginId, state);
    return { ...state };
  }

  async function persistInstallState(
    pluginId: PluginId,
    state: PluginInstallState,
  ): Promise<void> {
    installOverlay.set(pluginId, { ...state });
    await options.setInstallState?.(pluginId, { ...state });
  }

  async function contextFor(pluginId: PluginId): Promise<PluginContext> {
    return options.createContext(pluginId);
  }

  async function safeHook(
    entry: PluginEntry,
    hook: ManagerHook,
  ): Promise<string | undefined> {
    if (!entry.plugin) {
      return undefined;
    }
    const fn = resolveHook(entry.plugin, hook);
    if (!fn) {
      return undefined;
    }
    const timeoutMs = options.hookTimeoutMs ?? PLUGIN_HOOK_TIMEOUT_MS;
    const work = Promise.resolve().then(async () => {
      await fn.call(entry.plugin, await contextFor(entry.id));
    });
    work.catch(() => undefined);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(`${hook} timed out`));
          }, timeoutMs);
          timer.unref?.();
        }),
      ]);
      return undefined;
    } catch (error) {
      const message = errorMessage(error);
      options.logger.error(`plugin ${hook} failed`, {
        id: entry.id,
        error: message,
      });
      return message;
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }

  function fail(
    entry: PluginEntry,
    error: string,
    dropPlugin: boolean,
  ): PluginEntry {
    if (dropPlugin) {
      entry.plugin = undefined;
    }
    entry.status = "error";
    entry.error = error;
    entry.started = false;
    return entry;
  }

  function remember(entry: PluginEntry): PluginLoadResult {
    entries.set(entry.id, entry);
    return loadResult(entry);
  }

  async function importPlugin(
    entryFile: string,
    manifest: PluginManifest,
    cacheBust: boolean,
  ): Promise<FluxoPlugin> {
    const href = pluginImportHref(entryFile, cacheBust);
    const module = (await import(href)) as { default?: unknown };
    const exported = module.default;
    if (!isPluginShape(exported)) {
      throw new Error("plugin module must export default from definePlugin");
    }
    const exportedId = exportedPluginId(exported);
    if (exportedId !== undefined && exportedId !== manifest.id) {
      throw new Error("plugin export manifest id must match plugin.json");
    }
    return exported;
  }

  function baseEntry(
    pluginRoot: string,
    manifest: PluginManifest,
  ): PluginEntry {
    return {
      id: manifest.id,
      pluginRoot,
      manifest,
      plugin: undefined,
      status: "error",
      installed: false,
      enabled: false,
      started: false,
    };
  }

  async function loadCandidate(
    candidate: Candidate,
    cacheBust = false,
  ): Promise<PluginLoadResult> {
    const { pluginRoot, id, manifest } = candidate;

    if (manifest.id !== id) {
      const entry = baseEntry(pluginRoot, manifest);
      entry.id = id;
      return remember(
        fail(entry, "plugin directory name must equal manifest id", true),
      );
    }

    if (!forgeApiSatisfied(manifest.forgeApi, FORGE_API_VERSION)) {
      const message = new ForgeUnsupportedApiError(
        manifest.forgeApi,
        FORGE_API_VERSION,
      ).message;
      return remember(fail(baseEntry(pluginRoot, manifest), message, true));
    }

    let entryFile: string;
    try {
      entryFile = await resolvePluginEntryFile(pluginRoot, manifest.entry);
    } catch (error) {
      return remember(
        fail(baseEntry(pluginRoot, manifest), errorMessage(error), true),
      );
    }

    let plugin: FluxoPlugin;
    try {
      plugin = await importPlugin(entryFile, manifest, cacheBust);
    } catch (error) {
      const message = errorMessage(error);
      options.logger.error("plugin import failed", { id, error: message });
      return remember(fail(baseEntry(pluginRoot, manifest), message, true));
    }

    const install = await resolveInstallState(id);
    const entry: PluginEntry = {
      id,
      pluginRoot,
      manifest,
      plugin,
      status: install.installed
        ? install.enabled
          ? "enabled"
          : "installed"
        : "disabled",
      installed: install.installed,
      enabled: install.enabled,
      started: false,
    };

    if (entry.installed && entry.enabled) {
      const startError = await safeHook(entry, "onStart");
      if (startError) {
        return remember(fail(entry, startError, false));
      }
      entry.started = true;
      entry.status = "started";
    }

    return remember(entry);
  }

  async function collectCandidates(): Promise<{
    results: PluginLoadResult[];
    candidates: Candidate[];
  }> {
    const results: PluginLoadResult[] = [];
    const candidates: Candidate[] = [];
    let dirents;
    try {
      dirents = await readdir(options.directory, { withFileTypes: true });
    } catch (error) {
      options.logger.warn("plugins directory is not readable", {
        directory: options.directory,
        error: errorMessage(error),
      });
      return { results, candidates };
    }

    for (const dirent of dirents) {
      if (dirent.name.startsWith(".") || dirent.name === "node_modules") {
        continue;
      }

      let id: PluginId;
      try {
        id = assertSafePluginIdInput(dirent.name);
      } catch {
        results.push(failedResult(dirent.name, "Invalid plugin id"));
        continue;
      }

      let pluginRoot: string;
      try {
        pluginRoot = resolvePluginDirectory(options.directory, id);
      } catch (error) {
        results.push(failedResult(id, errorMessage(error)));
        continue;
      }

      let info;
      try {
        info = await stat(pluginRoot);
      } catch {
        continue;
      }
      if (!info.isDirectory()) {
        continue;
      }

      const manifestPath = path.join(pluginRoot, "plugin.json");
      try {
        await assertManifestInsideRoot(pluginRoot, manifestPath);
        const raw = await readJsonFile(manifestPath);
        const manifest = parsePluginManifest(raw);
        candidates.push({ pluginRoot, id, manifest });
      } catch (error) {
        const message = isEnoent(error)
          ? "Missing plugin.json"
          : errorMessage(error);
        results.push(failedResult(id, message));
      }
    }

    return { results, candidates };
  }

  async function loadDiscovered(cacheBust: boolean): Promise<PluginLoadResult[]> {
    const { results, candidates } = await collectCandidates();
    const claimed = new Map<string, Candidate[]>();
    for (const candidate of candidates) {
      const list = claimed.get(candidate.manifest.id) ?? [];
      list.push(candidate);
      claimed.set(candidate.manifest.id, list);
    }

    for (const [pluginId, group] of claimed) {
      if (group.length < 2) {
        continue;
      }
      const message = `duplicate plugin id: ${pluginId}`;
      const first = group[0];
      if (first) {
        remember(
          fail(baseEntry(first.pluginRoot, first.manifest), message, true),
        );
      }
      for (const candidate of group) {
        results.push(failedResult(candidate.manifest.id, message));
      }
    }

    for (const candidate of candidates) {
      const group = claimed.get(candidate.manifest.id);
      if (group && group.length > 1) {
        continue;
      }
      if (entries.has(candidate.id)) {
        const current = entries.get(candidate.id);
        if (current) {
          results.push(loadResult(current));
        }
        continue;
      }
      results.push(await loadCandidate(candidate, cacheBust));
    }

    return results;
  }

  async function loadAll(): Promise<PluginLoadResult[]> {
    return loadDiscovered(false);
  }

  async function requireEntry(id: string): Promise<PluginEntry> {
    const pluginId = parsePluginId(id);
    const entry = entries.get(pluginId);
    if (!entry) {
      throw new PluginNotFoundError(pluginId);
    }
    return entry;
  }

  async function stopEntry(entry: PluginEntry): Promise<string | undefined> {
    if (!entry.started) {
      return undefined;
    }
    const error = await safeHook(entry, "onStop");
    entry.started = false;
    if (entry.status !== "error") {
      entry.status = entry.enabled ? "enabled" : "disabled";
    }
    return error;
  }

  async function install(id: PluginId): Promise<void> {
    const entry = await requireEntry(id);
    if (!entry.plugin) {
      throw new PluginNotLoadableError(entry.id);
    }
    if (entry.status === "error") {
      return;
    }
    if (entry.installed) {
      return;
    }
    const hookError = await safeHook(entry, "onInstall");
    if (hookError) {
      fail(entry, hookError, false);
      return;
    }
    entry.installed = true;
    entry.enabled = false;
    entry.status = "installed";
    entry.error = undefined;
    await persistInstallState(entry.id, {
      installed: true,
      enabled: false,
    });
  }

  async function enable(id: PluginId): Promise<void> {
    const entry = await requireEntry(id);
    if (!entry.plugin) {
      throw new PluginNotLoadableError(entry.id);
    }
    if (entry.status === "error") {
      return;
    }
    if (!entry.installed) {
      throw new ForgeConflictError(`Plugin is not installed: ${entry.id}`);
    }
    if (entry.enabled && entry.started) {
      return;
    }
    if (!entry.enabled) {
      const enableError = await safeHook(entry, "onEnable");
      if (enableError) {
        fail(entry, enableError, false);
        return;
      }
      entry.enabled = true;
      entry.status = "enabled";
      entry.error = undefined;
      await persistInstallState(entry.id, {
        installed: true,
        enabled: true,
      });
    }
    if (entry.started) {
      return;
    }
    const startError = await safeHook(entry, "onStart");
    if (startError) {
      fail(entry, startError, false);
      return;
    }
    entry.started = true;
    entry.status = "started";
    entry.error = undefined;
  }

  async function disable(id: PluginId): Promise<void> {
    const entry = await requireEntry(id);
    if (!entry.plugin) {
      throw new PluginNotLoadableError(entry.id);
    }
    if (!entry.enabled && !entry.started) {
      return;
    }
    const stopError = await stopEntry(entry);
    const disableError = await safeHook(entry, "onDisable");
    entry.enabled = false;
    await persistInstallState(entry.id, {
      installed: entry.installed,
      enabled: false,
    });
    const error = stopError ?? disableError;
    if (error) {
      fail(entry, error, false);
      return;
    }
    entry.status = "disabled";
    entry.error = undefined;
  }

  async function uninstall(id: PluginId): Promise<void> {
    const entry = await requireEntry(id);
    if (!entry.plugin) {
      throw new PluginNotLoadableError(entry.id);
    }
    if (isErrorEntry(entry)) {
      return;
    }
    if (entry.enabled || entry.started) {
      await disable(id);
      if (isErrorEntry(entry)) {
        return;
      }
    }
    if (!entry.installed) {
      return;
    }
    const hookError = await safeHook(entry, "onUninstall");
    entry.installed = false;
    entry.enabled = false;
    entry.started = false;
    await persistInstallState(entry.id, {
      installed: false,
      enabled: false,
    });
    if (hookError) {
      fail(entry, hookError, false);
      return;
    }
    entry.status = "disabled";
    entry.error = undefined;
  }

  async function stopAll(): Promise<void> {
    for (const entry of entries.values()) {
      await stopEntry(entry);
    }
  }

  async function refresh(id?: PluginId): Promise<void> {
    if (id === undefined) {
      await stopAll();
      entries.clear();
      await loadDiscovered(true);
      return;
    }
    const pluginId = parsePluginId(id);
    const entry = entries.get(pluginId);
    if (!entry) {
      throw new PluginNotFoundError(pluginId);
    }
    const pluginRoot = entry.pluginRoot;
    await stopEntry(entry);
    entries.delete(pluginId);
    const manifestPath = path.join(pluginRoot, "plugin.json");
    try {
      await assertManifestInsideRoot(pluginRoot, manifestPath);
      const raw = await readJsonFile(manifestPath);
      const manifest = parsePluginManifest(raw);
      await loadCandidate({ pluginRoot, id: pluginId, manifest }, true);
    } catch (error) {
      remember(fail(entry, errorMessage(error), true));
    }
  }

  async function listDefinitions(): Promise<readonly PluginDefinition[]> {
    return list();
  }

  async function getDefinition(id: PluginId): Promise<PluginDefinition | null> {
    const pluginId = parsePluginId(id);
    const entry = entries.get(pluginId);
    return entry ? toDefinition(entry) : null;
  }

  function list(): readonly PluginDefinition[] {
    return [...entries.values()].map((entry) => toDefinition(entry));
  }

  function listActive(): readonly PluginDefinition[] {
    return [...entries.values()]
      .filter((entry) => entry.started && entry.status === "started")
      .map((entry) => toDefinition(entry));
  }

  function getActive(id: PluginId): FluxoPlugin | undefined {
    const entry = entries.get(id);
    if (!entry || !entry.started || entry.status !== "started") {
      return undefined;
    }
    return entry.plugin;
  }

  return {
    loadAll,
    install,
    uninstall,
    enable,
    disable,
    stopAll,
    refresh,
    listDefinitions,
    getDefinition,
    list,
    listActive,
    getActive,
  };
}

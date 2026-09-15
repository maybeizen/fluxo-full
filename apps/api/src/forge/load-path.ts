import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  ForgeValidationError,
  isSafeRelativeEntry,
  parsePluginId,
  type PluginId,
} from "@fluxo/forge";

const WINDOWS_DRIVE = /^[a-zA-Z]:/;
const URL_SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

export function assertSafePluginIdInput(value: unknown): PluginId {
  if (typeof value !== "string") {
    throw new ForgeValidationError("Invalid plugin id");
  }
  if (
    value.includes("\0") ||
    value.includes("..") ||
    value.includes("/") ||
    value.includes("\\") ||
    value.includes(":") ||
    WINDOWS_DRIVE.test(value) ||
    URL_SCHEME.test(value) ||
    path.isAbsolute(value) ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value)
  ) {
    throw new ForgeValidationError("Invalid plugin id");
  }
  return parsePluginId(value);
}

function resolveSafePluginPath(root: string, key: string): string {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, key);
  const relative = path.relative(resolvedRoot, resolved);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative === ""
  ) {
    throw new ForgeValidationError("Invalid plugin path");
  }
  return resolved;
}

export function resolvePluginDirectory(
  pluginsDir: string,
  pluginId: unknown,
): string {
  const id = assertSafePluginIdInput(pluginId);
  const resolved = resolveSafePluginPath(pluginsDir, id);
  const relative = path.relative(path.resolve(pluginsDir), resolved);
  if (relative !== id) {
    throw new ForgeValidationError("Invalid plugin id");
  }
  return resolved;
}

export function assertPathInside(root: string, target: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  const relative = path.relative(resolvedRoot, resolvedTarget);
  if (
    relative === "" ||
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new ForgeValidationError("Path escapes plugin root");
  }
}

export async function resolvePluginEntryFile(
  pluginRoot: string,
  entry: string,
): Promise<string> {
  if (!isSafeRelativeEntry(entry)) {
    throw new ForgeValidationError("Unsafe plugin entry path");
  }
  const rootReal = await realpath(pluginRoot);
  const candidate = resolveSafePluginPath(rootReal, entry);
  let targetReal: string;
  try {
    targetReal = await realpath(candidate);
  } catch {
    throw new ForgeValidationError(`Plugin entry not found: ${entry}`);
  }
  assertPathInside(rootReal, targetReal);
  const file = await stat(targetReal);
  if (!file.isFile()) {
    throw new ForgeValidationError("Plugin entry must be a file");
  }
  return targetReal;
}

import path from "node:path";
import { UnsafeStorageKeyError } from "./errors.js";

export function assertSafeKey(key: string): void {
  if (
    key.trim() === "" ||
    key.includes("\0") ||
    key.includes("..") ||
    path.isAbsolute(key) ||
    path.posix.isAbsolute(key) ||
    path.win32.isAbsolute(key)
  ) {
    throw new UnsafeStorageKeyError(key);
  }
}

export function resolveSafePath(root: string, key: string): string {
  assertSafeKey(key);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, key);
  const relative = path.relative(resolvedRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new UnsafeStorageKeyError(key);
  }
  return resolved;
}

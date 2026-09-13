import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LocalStorageConfig } from "@fluxo/types";
import { resolveSafePath } from "./keys.js";
import type { StorageDriver } from "./types.js";

export function createLocalStorage(config: LocalStorageConfig): StorageDriver {
  const root = path.resolve(config.directory);

  return {
    async put(key, body, contentType) {
      const dest = resolveSafePath(root, key);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, body);
      return { key, size: body.byteLength, contentType };
    },
    async get(key) {
      return readFile(resolveSafePath(root, key));
    },
    async delete(key) {
      await rm(resolveSafePath(root, key), { force: true });
    },
  };
}

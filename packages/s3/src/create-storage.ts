import path from "node:path";
import type { StorageConfig } from "@fluxo/types";
import { createLocalStorage } from "./local.js";
import { createS3Storage } from "./s3.js";
import type { StorageDriver } from "./types.js";

export function createStorage(config: StorageConfig): StorageDriver {
  if (config.s3) {
    return createS3Storage(config.s3);
  }

  return createLocalStorage({
    directory: config.local?.directory ?? path.join(process.cwd(), "storage"),
  });
}

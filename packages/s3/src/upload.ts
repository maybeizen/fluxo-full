import { mkdirSync } from "node:fs";
import path from "node:path";
import type { StorageConfig } from "@fluxo/types";
import multer from "multer";
import { UnsafeStorageKeyError } from "./errors.js";
import { assertSafeKey } from "./keys.js";

export function createUploadMiddleware(config: StorageConfig): multer.Multer {
  if (config.s3) {
    return multer({ storage: multer.memoryStorage() });
  }

  const directory = config.local?.directory ?? path.join(process.cwd(), "storage");
  mkdirSync(directory, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: directory,
      filename(_req, file, callback) {
        try {
          assertSafeKey(file.originalname);
          callback(null, file.originalname);
        } catch (error) {
          callback(
            error instanceof Error ? error : new UnsafeStorageKeyError(file.originalname),
            "",
          );
        }
      },
    }),
  });
}

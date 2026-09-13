import { randomBytes } from "node:crypto";
import { InvalidEncryptionKeyError } from "./errors.js";

export const KEY_BYTES = 32;
export const IV_BYTES = 12;
export const AUTH_TAG_BYTES = 16;
export const ALGORITHM = "aes-256-gcm";

export function generateKey(): string {
  return randomBytes(KEY_BYTES).toString("hex");
}

export function parseKey(key: string): Buffer {
  const decoded =
    key.length === KEY_BYTES * 2 && /^[0-9a-fA-F]+$/.test(key)
      ? Buffer.from(key, "hex")
      : Buffer.from(key, "base64");

  if (decoded.length !== KEY_BYTES) {
    throw new InvalidEncryptionKeyError();
  }

  return decoded;
}

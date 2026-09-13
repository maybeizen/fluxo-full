import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { EncryptedPayload } from "@fluxo/types";
import { ALGORITHM, AUTH_TAG_BYTES, IV_BYTES, generateKey, parseKey } from "./keys.js";

export { generateKey };

export function encrypt(plaintext: string, key: string): EncryptedPayload {
  const keyBytes = parseKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, keyBytes, iv, { authTagLength: AUTH_TAG_BYTES });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decrypt(payload: EncryptedPayload, key: string): string {
  const keyBytes = parseKey(key);
  const iv = Buffer.from(payload.iv, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const ciphertext = Buffer.from(payload.ciphertext, "base64");
  const decipher = createDecipheriv(ALGORITHM, keyBytes, iv, { authTagLength: AUTH_TAG_BYTES });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

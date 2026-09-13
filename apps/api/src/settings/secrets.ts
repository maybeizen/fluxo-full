import { decrypt, encrypt } from "@fluxo/crypto";
import type { EncryptedPayload } from "@fluxo/types";

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.iv === "string" &&
    typeof record.tag === "string" &&
    typeof record.ciphertext === "string"
  );
}

export function sealSecret(value: string | null, appKey: string): unknown {
  if (value === null) {
    return null;
  }
  if (appKey.length === 0) {
    return value;
  }
  return encrypt(value, appKey);
}

export function openSecret(value: unknown, appKey: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    if (appKey.length === 0) {
      return value.length === 0 ? null : value;
    }
    try {
      const parsed: unknown = JSON.parse(value);
      if (isEncryptedPayload(parsed)) {
        return decrypt(parsed, appKey);
      }
    } catch {
      return value.length === 0 ? null : value;
    }
    return value.length === 0 ? null : value;
  }
  if (isEncryptedPayload(value)) {
    if (appKey.length === 0) {
      return null;
    }
    return decrypt(value, appKey);
  }
  return null;
}

export function applySecretPatch(
  current: string | null,
  patch: string | null | undefined,
): string | null {
  if (patch === undefined || patch === "") {
    return current;
  }
  if (patch === null) {
    return null;
  }
  return patch;
}

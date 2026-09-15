import { ForgeValidationError } from "./errors.js";

export const FORBIDDEN_OBJECT_KEYS = [
  "__proto__",
  "constructor",
  "prototype",
] as const;

export const REDACTED = "[redacted]";

export const SENSITIVE_HEADER_NAMES = [
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-auth-token",
] as const;

const SENSITIVE_HEADER_SET = new Set<string>(SENSITIVE_HEADER_NAMES);

export function isForbiddenObjectKey(key: string): boolean {
  return (FORBIDDEN_OBJECT_KEYS as readonly string[]).includes(key);
}

export function assertNoPrototypePollution(value: unknown): void {
  if (typeof value !== "object" || value === null) {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      assertNoPrototypePollution(item);
    }
    return;
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    throw new ForgeValidationError("Non-plain object");
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || isForbiddenObjectKey(key)) {
      throw new ForgeValidationError(`Forbidden object key: ${String(key)}`);
    }
    assertNoPrototypePollution((value as Record<string, unknown>)[key]);
  }
}

export function isSafeRelativeEntry(value: string): boolean {
  if (value.length === 0 || value.length > 200) {
    return false;
  }
  if (value.includes("\0") || value.includes("..")) {
    return false;
  }
  if (value.startsWith("/") || value.startsWith("\\")) {
    return false;
  }
  if (/^[a-zA-Z]:/.test(value)) {
    return false;
  }
  return /^[A-Za-z0-9._/-]+$/.test(value);
}

export function redactHeaders(
  headers: Readonly<Record<string, string>>,
): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    redacted[key] = SENSITIVE_HEADER_SET.has(key.toLowerCase())
      ? REDACTED
      : value;
  }
  return redacted;
}

export function isSafeStorageKey(key: string): boolean {
  return (
    key.length > 0 &&
    key.length <= 200 &&
    !key.includes("\0") &&
    !key.includes("..") &&
    !key.startsWith("/") &&
    !/^[a-zA-Z]:/.test(key) &&
    /^[A-Za-z0-9._/-]+$/.test(key)
  );
}

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "fluxo.sid";

export function hashSessionId(rawId: string): string {
  return createHash("sha256").update(rawId).digest("hex");
}

export function signSessionId(rawId: string, secret: string): string {
  return createHmac("sha256", secret).update(rawId).digest("hex");
}

export function createRawSessionId(): string {
  return randomBytes(32).toString("hex");
}

export function encodeSessionCookie(rawId: string, secret: string): string {
  return `${rawId}.${signSessionId(rawId, secret)}`;
}

export function decodeSessionCookie(value: string, secret: string): string | null {
  const separator = value.lastIndexOf(".");
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }

  const rawId = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = signSessionId(rawId, secret);
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) {
    return null;
  }

  return timingSafeEqual(left, right) ? rawId : null;
}

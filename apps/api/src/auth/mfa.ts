import { decrypt, encrypt } from "@fluxo/crypto";
import type { EncryptedPayload } from "@fluxo/types";
import * as OTPAuth from "otpauth";

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

export function sealMfaSecret(secret: string, appKey: string): string {
  if (appKey.length === 0) {
    return secret;
  }

  return JSON.stringify(encrypt(secret, appKey));
}

export function openMfaSecret(stored: string, appKey: string): string {
  if (appKey.length === 0) {
    return stored;
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (isEncryptedPayload(parsed)) {
      return decrypt(parsed, appKey);
    }
  } catch {
    return stored;
  }

  return stored;
}

export function verifyTotp(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    digits: 6,
    period: 30,
  });

  return totp.validate({ token: code, window: 1 }) !== null;
}

export function generateTotpSecret(): string {
  return new OTPAuth.Secret().base32;
}

export function createOtpauthUrl(input: {
  secret: string;
  label: string;
  issuer: string;
}): string {
  return new OTPAuth.TOTP({
    issuer: input.issuer,
    label: input.label,
    secret: OTPAuth.Secret.fromBase32(input.secret),
    digits: 6,
    period: 30,
  }).toString();
}

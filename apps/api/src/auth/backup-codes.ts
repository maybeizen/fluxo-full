import { randomBytes } from "node:crypto";
import { hashAuthToken } from "./tokens.js";

export const BACKUP_CODE_COUNT = 10;

export function generateBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(4).toString("hex");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
}

export function normalizeBackupCode(code: string): string {
  return code.trim().toLowerCase();
}

export function hashBackupCode(code: string): string {
  return hashAuthToken(normalizeBackupCode(code));
}

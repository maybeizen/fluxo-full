import type { AuthConfig } from "./stores/types.js";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function avatarStorageKey(userId: string): string {
  return `avatars/${userId}`;
}

export function avatarPublicUrl(config: AuthConfig, key: string): string {
  const base = config.storagePublicUrlBase ?? `${config.apiUrl.replace(/\/$/, "")}/files`;
  return `${base.replace(/\/$/, "")}/${key}`;
}

export function isAvatarFile(file: File): boolean {
  return AVATAR_TYPES.has(file.type) && file.size > 0 && file.size <= AVATAR_MAX_BYTES;
}

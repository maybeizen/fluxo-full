import type { Redis } from "@fluxo/redis";
import type { SessionCacheRecord, SessionCacheStore, WebAuthnChallengeStore } from "./types.js";

const SESSION_CACHE_PREFIX = "fluxo:session:";
const WEBAUTHN_PREFIX = "fluxo:webauthn:";

function cacheKey(id: string): string {
  return `${SESSION_CACHE_PREFIX}${id}`;
}

function parseRecord(value: string): SessionCacheRecord | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    if (
      typeof record.userId !== "string" ||
      typeof record.mfaVerified !== "boolean" ||
      typeof record.expiresAt !== "string"
    ) {
      return null;
    }

    return {
      userId: record.userId,
      mfaVerified: record.mfaVerified,
      expiresAt: record.expiresAt,
    };
  } catch {
    return null;
  }
}

export function createRedisWebAuthnChallengeStore(
  redis: Pick<Redis, "get" | "set" | "del">,
): WebAuthnChallengeStore {
  return {
    async set(key, challenge, ttlSeconds) {
      await redis.set(`${WEBAUTHN_PREFIX}${key}`, challenge, "EX", ttlSeconds);
    },
    async consume(key) {
      const value = await redis.get(`${WEBAUTHN_PREFIX}${key}`);
      await redis.del(`${WEBAUTHN_PREFIX}${key}`);
      return value;
    },
  };
}

export function createRedisSessionCache(
  redis: Pick<Redis, "get" | "set" | "del">,
): SessionCacheStore {
  return {
    async get(id) {
      const value = await redis.get(cacheKey(id));
      if (value === null) {
        return null;
      }
      return parseRecord(value);
    },

    async set(id, record, ttlSeconds) {
      await redis.set(cacheKey(id), JSON.stringify(record), "EX", ttlSeconds);
    },

    async delete(id) {
      await redis.del(cacheKey(id));
    },
  };
}

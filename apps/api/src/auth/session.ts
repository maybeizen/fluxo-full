import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import {
  createRawSessionId,
  decodeSessionCookie,
  encodeSessionCookie,
  hashSessionId,
  SESSION_COOKIE_NAME,
} from "./cookie.js";
import type {
  SessionCacheStore,
  SessionDurableStore,
  SessionEngineConfig,
  SessionRecord,
} from "./stores/types.js";

const DAY_SECONDS = 86_400;

export class SessionConfigError extends Error {
  override readonly name = "SessionConfigError";

  constructor(message = "SESSION_SECRET is required") {
    super(message);
  }
}

export interface CreateSessionInput {
  userId: string;
  mfaVerified: boolean;
  rememberMe: boolean;
  userAgent?: string | null;
  ip?: string | null;
}

export interface ResolvedSession {
  id: string;
  cookieValue: string;
  userId: string;
  mfaVerified: boolean;
  expiresAt: Date;
}

export interface SessionEngine {
  create(input: CreateSessionInput): Promise<string>;
  resolve(cookieValue: string | undefined): Promise<ResolvedSession | null>;
  touch(session: ResolvedSession): Promise<void>;
  markMfaVerified(session: ResolvedSession): Promise<void>;
  listForUser(userId: string): Promise<SessionRecord[]>;
  destroy(cookieValue: string | undefined): Promise<void>;
  destroyById(id: string): Promise<void>;
  destroyAllForUser(userId: string): Promise<void>;
  destroyOthersForUser(userId: string, keepId: string): Promise<void>;
  attachCookie(c: Context, cookieValue: string, rememberMe: boolean): void;
  clearCookie(c: Context): void;
}

function ttlSeconds(expiresAt: Date, now: number): number {
  return Math.max(1, Math.floor((expiresAt.getTime() - now) / 1000));
}

function cookieDomain(config: SessionEngineConfig): { domain?: string } {
  return config.cookieDomain ? { domain: config.cookieDomain } : {};
}

async function writeCache(
  cache: SessionCacheStore,
  record: SessionRecord,
): Promise<void> {
  await cache.set(
    record.id,
    {
      userId: record.userId,
      mfaVerified: record.mfaVerifiedAt !== null,
      expiresAt: record.expiresAt.toISOString(),
    },
    ttlSeconds(record.expiresAt, Date.now()),
  );
}

export function createSessionEngine(options: {
  durable: SessionDurableStore;
  cache: SessionCacheStore;
  config: SessionEngineConfig;
}): SessionEngine {
  if (options.config.secret.length === 0) {
    throw new SessionConfigError();
  }

  const { durable, cache, config } = options;

  return {
    async create(input) {
      const rawId = createRawSessionId();
      const id = hashSessionId(rawId);
      const now = new Date();
      const maxAge = input.rememberMe ? config.lifetimeDays * DAY_SECONDS : DAY_SECONDS;
      const expiresAt = new Date(now.getTime() + maxAge * 1000);
      const record: SessionRecord = {
        id,
        userId: input.userId,
        expiresAt,
        createdAt: now,
        lastSeenAt: now,
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
        mfaVerifiedAt: input.mfaVerified ? now : null,
      };

      await durable.insert(record);
      await writeCache(cache, record);
      return encodeSessionCookie(rawId, config.secret);
    },

    async resolve(cookieValue) {
      if (!cookieValue) {
        return null;
      }

      const rawId = decodeSessionCookie(cookieValue, config.secret);
      if (!rawId) {
        return null;
      }

      const id = hashSessionId(rawId);
      const now = Date.now();
      const cached = await cache.get(id);
      if (cached) {
        const expiresAt = new Date(cached.expiresAt);
        if (expiresAt.getTime() <= now) {
          await Promise.all([cache.delete(id), durable.delete(id)]);
          return null;
        }

        return {
          id,
          cookieValue,
          userId: cached.userId,
          mfaVerified: cached.mfaVerified,
          expiresAt,
        };
      }

      const record = await durable.findById(id);
      if (!record || record.expiresAt.getTime() <= now) {
        if (record) {
          await durable.delete(id);
        }
        return null;
      }

      await writeCache(cache, record);
      return {
        id,
        cookieValue,
        userId: record.userId,
        mfaVerified: record.mfaVerifiedAt !== null,
        expiresAt: record.expiresAt,
      };
    },

    async touch(session) {
      const record = await durable.findById(session.id);
      if (!record) {
        return;
      }

      record.lastSeenAt = new Date();
      await durable.update(record);
      await writeCache(cache, record);
    },

    async markMfaVerified(session) {
      const record = await durable.findById(session.id);
      if (!record) {
        return;
      }

      const now = new Date();
      record.mfaVerifiedAt = now;
      record.lastSeenAt = now;
      await durable.update(record);
      await writeCache(cache, record);
      session.mfaVerified = true;
    },

    async listForUser(userId) {
      return durable.listByUserId(userId);
    },

    async destroy(cookieValue) {
      if (!cookieValue) {
        return;
      }

      const rawId = decodeSessionCookie(cookieValue, config.secret);
      if (!rawId) {
        return;
      }

      const id = hashSessionId(rawId);
      await Promise.all([durable.delete(id), cache.delete(id)]);
    },

    async destroyById(id) {
      await Promise.all([durable.delete(id), cache.delete(id)]);
    },

    async destroyAllForUser(userId) {
      const ids = await durable.deleteByUserId(userId);
      await Promise.all(ids.map((id) => cache.delete(id)));
    },

    async destroyOthersForUser(userId, keepId) {
      const ids = await durable.deleteByUserIdExcept(userId, keepId);
      await Promise.all(ids.map((id) => cache.delete(id)));
    },

    attachCookie(c, cookieValue, rememberMe) {
      setCookie(c, SESSION_COOKIE_NAME, cookieValue, {
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
        secure: config.secure,
        maxAge: rememberMe ? config.lifetimeDays * DAY_SECONDS : DAY_SECONDS,
        ...cookieDomain(config),
      });
    },

    clearCookie(c) {
      deleteCookie(c, SESSION_COOKIE_NAME, {
        path: "/",
        secure: config.secure,
        ...cookieDomain(config),
      });
    },
  };
}

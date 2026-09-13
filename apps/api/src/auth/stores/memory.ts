import { randomUUID } from "node:crypto";
import type { StorageDriver } from "@fluxo/s3";
import { createMemorySettingsRuntime } from "../../settings/runtime.js";
import type { CaptchaVerifier } from "../../settings/captcha.js";
import type { Mailer } from "../../settings/mailer.js";
import { createSessionEngine } from "../session.js";
import { createSimpleWebAuthnService } from "../webauthn.js";
import type {
  AuthConfig,
  AuthTokenRecord,
  AuthTokenStore,
  BackupCodeStore,
  PasskeyRecord,
  PasskeyStore,
  SessionCacheStore,
  SessionDurableStore,
  SessionRecord,
  StepUpStore,
  UserRecord,
  UserStore,
  WebAuthnChallengeStore,
} from "./types.js";
import type { WebAuthnService } from "../webauthn.js";

function cloneUser(user: UserRecord): UserRecord {
  return { ...user };
}

function cloneSession(record: SessionRecord): SessionRecord {
  return {
    ...record,
    expiresAt: new Date(record.expiresAt),
    createdAt: new Date(record.createdAt),
    lastSeenAt: new Date(record.lastSeenAt),
    mfaVerifiedAt: record.mfaVerifiedAt ? new Date(record.mfaVerifiedAt) : null,
  };
}

function clonePasskey(record: PasskeyRecord): PasskeyRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    lastUsedAt: record.lastUsedAt ? new Date(record.lastUsedAt) : null,
  };
}

export function createMemoryUserStore(): UserStore {
  const users = new Map<string, UserRecord>();

  return {
    async count() {
      return users.size;
    },

    async countByRole(role) {
      let total = 0;
      for (const user of users.values()) {
        if (user.role === role) {
          total += 1;
        }
      }
      return total;
    },

    async list() {
      return [...users.values()]
        .map(cloneUser)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    },

    async create(input) {
      const now = new Date();
      const user: UserRecord = {
        id: randomUUID(),
        username: input.username,
        email: input.email,
        emailVerifiedAt: input.emailVerifiedAt,
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        avatarUrl: input.avatarUrl ?? null,
        avatarSource: input.avatarSource ?? "none",
        dateOfBirth: input.dateOfBirth ?? null,
        company: input.company ?? null,
        role: input.role,
        mfaEnabled: input.mfaEnabled ?? false,
        mfaSecret: input.mfaSecret ?? null,
        suspendedAt: null,
        suspendedReason: null,
        createdAt: now,
        updatedAt: now,
      };
      users.set(user.id, user);
      return cloneUser(user);
    },

    async findById(id) {
      const user = users.get(id);
      return user ? cloneUser(user) : null;
    },

    async findByUsername(username) {
      const normalized = username.toLowerCase();
      for (const user of users.values()) {
        if (user.username.toLowerCase() === normalized) {
          return cloneUser(user);
        }
      }
      return null;
    },

    async findByEmail(email) {
      const normalized = email.toLowerCase();
      for (const user of users.values()) {
        if (user.email.toLowerCase() === normalized) {
          return cloneUser(user);
        }
      }
      return null;
    },

    async update(id, input) {
      const user = users.get(id);
      if (!user) {
        return null;
      }
      if (input.firstName !== undefined) {
        user.firstName = input.firstName;
      }
      if (input.lastName !== undefined) {
        user.lastName = input.lastName;
      }
      if (input.username !== undefined) {
        user.username = input.username;
      }
      if (input.dateOfBirth !== undefined) {
        user.dateOfBirth = input.dateOfBirth;
      }
      if (input.company !== undefined) {
        user.company = input.company;
      }
      if (input.email !== undefined) {
        user.email = input.email;
      }
      if (input.emailVerifiedAt !== undefined) {
        user.emailVerifiedAt = input.emailVerifiedAt;
      }
      if (input.avatarUrl !== undefined) {
        user.avatarUrl = input.avatarUrl;
      }
      if (input.avatarSource !== undefined) {
        user.avatarSource = input.avatarSource;
      }
      if (input.passwordHash !== undefined) {
        user.passwordHash = input.passwordHash;
      }
      if (input.mfaEnabled !== undefined) {
        user.mfaEnabled = input.mfaEnabled;
      }
      if (input.mfaSecret !== undefined) {
        user.mfaSecret = input.mfaSecret;
      }
      if (input.role !== undefined) {
        user.role = input.role;
      }
      if (input.suspendedAt !== undefined) {
        user.suspendedAt = input.suspendedAt;
      }
      if (input.suspendedReason !== undefined) {
        user.suspendedReason = input.suspendedReason;
      }
      user.updatedAt = new Date();
      return cloneUser(user);
    },

    async updatePassword(id, passwordHash) {
      await this.update(id, { passwordHash });
    },

    async markEmailVerified(id) {
      await this.update(id, { emailVerifiedAt: new Date() });
    },

    async updateMfa(id, input) {
      await this.update(id, { mfaEnabled: input.mfaEnabled, mfaSecret: input.mfaSecret });
    },

    async delete(id) {
      return users.delete(id);
    },
  };
}

export function createMemorySessionStore(): SessionDurableStore {
  const rows = new Map<string, SessionRecord>();

  return {
    async insert(record) {
      rows.set(record.id, cloneSession(record));
    },

    async findById(id) {
      const record = rows.get(id);
      return record ? cloneSession(record) : null;
    },

    async listByUserId(userId) {
      return [...rows.values()]
        .filter((record) => record.userId === userId)
        .map(cloneSession)
        .sort((left, right) => right.lastSeenAt.getTime() - left.lastSeenAt.getTime());
    },

    async update(record) {
      rows.set(record.id, cloneSession(record));
    },

    async delete(id) {
      rows.delete(id);
    },

    async deleteByUserId(userId) {
      const ids: string[] = [];
      for (const [id, record] of rows) {
        if (record.userId === userId) {
          ids.push(id);
          rows.delete(id);
        }
      }
      return ids;
    },

    async deleteByUserIdExcept(userId, exceptId) {
      const ids: string[] = [];
      for (const [id, record] of rows) {
        if (record.userId === userId && id !== exceptId) {
          ids.push(id);
          rows.delete(id);
        }
      }
      return ids;
    },
  };
}

export function createMemorySessionCache(): SessionCacheStore {
  const rows = new Map<
    string,
    { record: { userId: string; mfaVerified: boolean; expiresAt: string }; expiresAtMs: number }
  >();

  return {
    async get(id) {
      const entry = rows.get(id);
      if (!entry) {
        return null;
      }
      if (entry.expiresAtMs <= Date.now()) {
        rows.delete(id);
        return null;
      }
      return { ...entry.record };
    },

    async set(id, record, ttlSeconds) {
      rows.set(id, {
        record: { ...record },
        expiresAtMs: Date.now() + ttlSeconds * 1000,
      });
    },

    async delete(id) {
      rows.delete(id);
    },
  };
}

export function createMemoryTokenStore(): AuthTokenStore {
  const rows = new Map<string, AuthTokenRecord>();

  return {
    async create(input) {
      rows.set(input.tokenHash, {
        ...input,
        data: input.data ?? null,
        expiresAt: new Date(input.expiresAt),
      });
    },

    async consume(tokenHash, type) {
      const record = rows.get(tokenHash);
      if (!record || record.type !== type) {
        return null;
      }
      rows.delete(tokenHash);
      if (record.expiresAt.getTime() <= Date.now()) {
        return null;
      }
      return { userId: record.userId, data: record.data ?? null };
    },

    async deleteByUserIdAndType(userId, type) {
      for (const [hash, record] of rows) {
        if (record.userId === userId && record.type === type) {
          rows.delete(hash);
        }
      }
    },
  };
}

export function createMemoryPasskeyStore(): PasskeyStore {
  const rows = new Map<string, PasskeyRecord>();

  return {
    async listByUserId(userId) {
      return [...rows.values()]
        .filter((record) => record.userId === userId)
        .map(clonePasskey)
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
    },

    async findById(id) {
      const record = rows.get(id);
      return record ? clonePasskey(record) : null;
    },

    async hasForUser(userId) {
      for (const record of rows.values()) {
        if (record.userId === userId) {
          return true;
        }
      }
      return false;
    },

    async create(input) {
      const now = new Date();
      const record: PasskeyRecord = {
        ...input,
        createdAt: now,
        lastUsedAt: null,
      };
      rows.set(record.id, record);
      return clonePasskey(record);
    },

    async touch(id, counter) {
      const record = rows.get(id);
      if (!record) {
        return;
      }
      record.counter = counter;
      record.lastUsedAt = new Date();
    },

    async delete(id, userId) {
      const record = rows.get(id);
      if (!record || record.userId !== userId) {
        return false;
      }
      rows.delete(id);
      return true;
    },
  };
}

export function createMemoryBackupCodeStore(): BackupCodeStore {
  const rows = new Map<string, { userId: string; codeHash: string; usedAt: Date | null }>();

  return {
    async replaceAll(userId, codeHashes) {
      for (const [id, record] of rows) {
        if (record.userId === userId) {
          rows.delete(id);
        }
      }
      for (const codeHash of codeHashes) {
        rows.set(randomUUID(), { userId, codeHash, usedAt: null });
      }
    },

    async consume(userId, codeHash) {
      for (const record of rows.values()) {
        if (record.userId === userId && record.codeHash === codeHash && record.usedAt === null) {
          record.usedAt = new Date();
          return true;
        }
      }
      return false;
    },

    async deleteAll(userId) {
      for (const [id, record] of rows) {
        if (record.userId === userId) {
          rows.delete(id);
        }
      }
    },
  };
}

export function createMemoryStepUpStore(): StepUpStore {
  const rows = new Map<
    string,
    { userId: string; sessionId: string; expiresAt: Date; usedAt: Date | null }
  >();

  return {
    async create(input) {
      rows.set(input.id, {
        userId: input.userId,
        sessionId: input.sessionId,
        expiresAt: new Date(input.expiresAt),
        usedAt: null,
      });
    },

    async consume(id, userId, sessionId) {
      const record = rows.get(id);
      if (!record || record.userId !== userId || record.sessionId !== sessionId) {
        return false;
      }
      if (record.usedAt !== null || record.expiresAt.getTime() <= Date.now()) {
        return false;
      }
      record.usedAt = new Date();
      return true;
    },
  };
}

export function createMemoryWebAuthnChallengeStore(): WebAuthnChallengeStore {
  const rows = new Map<string, { challenge: string; expiresAtMs: number }>();

  return {
    async set(key, challenge, ttlSeconds) {
      rows.set(key, { challenge, expiresAtMs: Date.now() + ttlSeconds * 1000 });
    },

    async consume(key) {
      const entry = rows.get(key);
      rows.delete(key);
      if (!entry || entry.expiresAtMs <= Date.now()) {
        return null;
      }
      return entry.challenge;
    },
  };
}

export function createMemoryStorage(): StorageDriver {
  const files = new Map<string, { body: Buffer; contentType?: string }>();

  return {
    async put(key, body, contentType) {
      files.set(key, { body, contentType });
      return { key, size: body.byteLength, contentType };
    },
    async get(key) {
      const entry = files.get(key);
      if (!entry) {
        throw new Error("not found");
      }
      return entry.body;
    },
    async delete(key) {
      files.delete(key);
    },
  };
}

export function createMemoryAuth(options?: {
  secret?: string;
  lifetimeDays?: number;
  cookieDomain?: string;
  secure?: boolean;
  nodeEnv?: AuthConfig["nodeEnv"];
  bcryptRounds?: number;
  appKey?: string;
  appName?: string;
  frontendUrl?: string;
  apiUrl?: string;
  storagePublicUrlBase?: string;
  webauthn?: WebAuthnService;
  mailer?: Mailer;
  captchaVerifier?: CaptchaVerifier;
}) {
  const users = createMemoryUserStore();
  const tokens = createMemoryTokenStore();
  const durable = createMemorySessionStore();
  const cache = createMemorySessionCache();
  const passkeys = createMemoryPasskeyStore();
  const backupCodes = createMemoryBackupCodeStore();
  const stepUps = createMemoryStepUpStore();
  const webauthnChallenges = createMemoryWebAuthnChallengeStore();
  const storage = createMemoryStorage();
  const sessions = createSessionEngine({
    durable,
    cache,
    config: {
      secret: options?.secret ?? "test-session-secret-32-bytes-minimum!!",
      lifetimeDays: options?.lifetimeDays ?? 7,
      cookieDomain: options?.cookieDomain,
      secure: options?.secure ?? false,
    },
  });
  const config = {
    nodeEnv: options?.nodeEnv ?? "test",
    bcryptRounds: options?.bcryptRounds ?? 4,
    appKey: options?.appKey ?? "",
    appName: options?.appName ?? "Fluxo",
    frontendUrl: options?.frontendUrl ?? "http://localhost:5173",
    apiUrl: options?.apiUrl ?? "http://localhost:3000",
    storagePublicUrlBase: options?.storagePublicUrlBase,
  } satisfies AuthConfig;
  const settings = createMemorySettingsRuntime(
    {
      appName: config.appName,
      appBaseUrl: config.frontendUrl,
      apiUrl: config.apiUrl,
      appKey: config.appKey,
      storageProvider: "local",
      s3ForcePathStyle: true,
      s3PublicUrlBase: config.storagePublicUrlBase,
    },
    {
      authConfig: config,
      storage,
      mailer: options?.mailer,
      captchaVerifier: options?.captchaVerifier,
    },
  );

  return {
    users,
    tokens,
    sessions,
    passkeys,
    backupCodes,
    stepUps,
    webauthnChallenges,
    storage: settings.storage,
    webauthn: options?.webauthn ?? createSimpleWebAuthnService(),
    durable,
    cache,
    config,
    settings,
  };
}

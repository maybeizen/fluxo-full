import {
  authTokens,
  mfaBackupCodes,
  sessions,
  stepUpChallenges,
  users,
  webauthnCredentials,
  type FluxoDatabase,
} from "@fluxo/db";
import type { AvatarSource } from "@fluxo/types";
import { UserRole } from "@fluxo/types";
import { and, count, desc, eq, isNull, ne } from "drizzle-orm";
import type {
  AuthTokenStore,
  BackupCodeStore,
  PasskeyRecord,
  PasskeyStore,
  SessionDurableStore,
  SessionRecord,
  StepUpStore,
  UpdateUserInput,
  UserRecord,
  UserStore,
} from "./types.js";

type Db = FluxoDatabase["db"];

function toRole(role: "user" | "admin"): UserRole {
  return role === "admin" ? UserRole.Admin : UserRole.User;
}

function toAvatarSource(value: "upload" | "gravatar" | "none"): AvatarSource {
  return value;
}

function toUserRecord(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    emailVerifiedAt: row.emailVerifiedAt,
    passwordHash: row.passwordHash,
    firstName: row.firstName,
    lastName: row.lastName,
    avatarUrl: row.avatarUrl,
    avatarSource: toAvatarSource(row.avatarSource),
    dateOfBirth: row.dateOfBirth,
    company: row.company,
    role: toRole(row.role),
    mfaEnabled: row.mfaEnabled,
    mfaSecret: row.mfaSecret,
    suspendedAt: row.suspendedAt,
    suspendedReason: row.suspendedReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSessionRecord(row: typeof sessions.$inferSelect): SessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    userAgent: row.userAgent,
    ip: row.ip,
    mfaVerifiedAt: row.mfaVerifiedAt,
  };
}

function toPasskeyRecord(row: typeof webauthnCredentials.$inferSelect): PasskeyRecord {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    publicKey: row.publicKey,
    counter: row.counter,
    transports: row.transports,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
  };
}

type UserPatch = Partial<typeof users.$inferInsert> & { updatedAt: Date };

function userPatch(input: UpdateUserInput): UserPatch {
  const patch: UserPatch = { updatedAt: new Date() };
  if (input.firstName !== undefined) {
    patch.firstName = input.firstName;
  }
  if (input.lastName !== undefined) {
    patch.lastName = input.lastName;
  }
  if (input.username !== undefined) {
    patch.username = input.username;
  }
  if (input.dateOfBirth !== undefined) {
    patch.dateOfBirth = input.dateOfBirth;
  }
  if (input.company !== undefined) {
    patch.company = input.company;
  }
  if (input.email !== undefined) {
    patch.email = input.email;
  }
  if (input.emailVerifiedAt !== undefined) {
    patch.emailVerifiedAt = input.emailVerifiedAt;
  }
  if (input.avatarUrl !== undefined) {
    patch.avatarUrl = input.avatarUrl;
  }
  if (input.avatarSource !== undefined) {
    patch.avatarSource = input.avatarSource;
  }
  if (input.passwordHash !== undefined) {
    patch.passwordHash = input.passwordHash;
  }
  if (input.mfaEnabled !== undefined) {
    patch.mfaEnabled = input.mfaEnabled;
  }
  if (input.mfaSecret !== undefined) {
    patch.mfaSecret = input.mfaSecret;
  }
  if (input.role !== undefined) {
    patch.role = input.role;
  }
  if (input.suspendedAt !== undefined) {
    patch.suspendedAt = input.suspendedAt;
  }
  if (input.suspendedReason !== undefined) {
    patch.suspendedReason = input.suspendedReason;
  }
  return patch;
}

export function createPostgresUserStore(db: Db): UserStore {
  return {
    async count() {
      const [row] = await db.select({ value: count() }).from(users);
      return Number(row?.value ?? 0);
    },

    async countByRole(role) {
      const [row] = await db.select({ value: count() }).from(users).where(eq(users.role, role));
      return Number(row?.value ?? 0);
    },

    async list() {
      const rows = await db.select().from(users).orderBy(desc(users.createdAt));
      return rows.map(toUserRecord);
    },

    async create(input) {
      const [row] = await db
        .insert(users)
        .values({
          username: input.username,
          email: input.email,
          passwordHash: input.passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          emailVerifiedAt: input.emailVerifiedAt,
          avatarUrl: input.avatarUrl ?? null,
          avatarSource: input.avatarSource ?? "none",
          dateOfBirth: input.dateOfBirth ?? null,
          company: input.company ?? null,
          mfaEnabled: input.mfaEnabled ?? false,
          mfaSecret: input.mfaSecret ?? null,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to create user");
      }

      return toUserRecord(row);
    },

    async findById(id) {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return row ? toUserRecord(row) : null;
    },

    async findByUsername(username) {
      const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
      return row ? toUserRecord(row) : null;
    },

    async findByEmail(email) {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row ? toUserRecord(row) : null;
    },

    async update(id, input) {
      await db
        .update(users)
        .set(userPatch(input))
        .where(eq(users.id, id));
      return this.findById(id);
    },

    async updatePassword(id, passwordHash) {
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, id));
    },

    async markEmailVerified(id) {
      const now = new Date();
      await db
        .update(users)
        .set({ emailVerifiedAt: now, updatedAt: now })
        .where(eq(users.id, id));
    },

    async updateMfa(id, input) {
      await db
        .update(users)
        .set({
          mfaEnabled: input.mfaEnabled,
          mfaSecret: input.mfaSecret,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id));
    },

    async delete(id) {
      const rows = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
      return rows.length > 0;
    },
  };
}

export function createPostgresSessionStore(db: Db): SessionDurableStore {
  return {
    async insert(record) {
      await db.insert(sessions).values(record);
    },

    async findById(id) {
      const [row] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      return row ? toSessionRecord(row) : null;
    },

    async listByUserId(userId) {
      const rows = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, userId))
        .orderBy(desc(sessions.lastSeenAt));
      return rows.map(toSessionRecord);
    },

    async update(record) {
      await db
        .update(sessions)
        .set({
          userId: record.userId,
          expiresAt: record.expiresAt,
          lastSeenAt: record.lastSeenAt,
          userAgent: record.userAgent,
          ip: record.ip,
          mfaVerifiedAt: record.mfaVerifiedAt,
        })
        .where(eq(sessions.id, record.id));
    },

    async delete(id) {
      await db.delete(sessions).where(eq(sessions.id, id));
    },

    async deleteByUserId(userId) {
      const rows = await db
        .delete(sessions)
        .where(eq(sessions.userId, userId))
        .returning({ id: sessions.id });
      return rows.map((row) => row.id);
    },

    async deleteByUserIdExcept(userId, exceptId) {
      const rows = await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), ne(sessions.id, exceptId)))
        .returning({ id: sessions.id });
      return rows.map((row) => row.id);
    },
  };
}

export function createPostgresTokenStore(db: Db): AuthTokenStore {
  return {
    async create(input) {
      await db.insert(authTokens).values({
        tokenHash: input.tokenHash,
        userId: input.userId,
        type: input.type,
        data: input.data ?? null,
        expiresAt: input.expiresAt,
      });
    },

    async consume(tokenHash, type) {
      const [row] = await db
        .select()
        .from(authTokens)
        .where(eq(authTokens.tokenHash, tokenHash))
        .limit(1);

      if (!row || row.type !== type) {
        return null;
      }

      await db.delete(authTokens).where(eq(authTokens.tokenHash, tokenHash));

      if (row.expiresAt.getTime() <= Date.now()) {
        return null;
      }

      return { userId: row.userId, data: row.data };
    },

    async deleteByUserIdAndType(userId, type) {
      await db
        .delete(authTokens)
        .where(and(eq(authTokens.userId, userId), eq(authTokens.type, type)));
    },
  };
}

export function createPostgresPasskeyStore(db: Db): PasskeyStore {
  return {
    async listByUserId(userId) {
      const rows = await db
        .select()
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, userId))
        .orderBy(desc(webauthnCredentials.createdAt));
      return rows.map(toPasskeyRecord);
    },

    async findById(id) {
      const [row] = await db
        .select()
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.id, id))
        .limit(1);
      return row ? toPasskeyRecord(row) : null;
    },

    async hasForUser(userId) {
      const [row] = await db
        .select({ id: webauthnCredentials.id })
        .from(webauthnCredentials)
        .where(eq(webauthnCredentials.userId, userId))
        .limit(1);
      return Boolean(row);
    },

    async create(input) {
      const [row] = await db.insert(webauthnCredentials).values(input).returning();
      if (!row) {
        throw new Error("Failed to create passkey");
      }
      return toPasskeyRecord(row);
    },

    async touch(id, counter) {
      await db
        .update(webauthnCredentials)
        .set({ counter, lastUsedAt: new Date() })
        .where(eq(webauthnCredentials.id, id));
    },

    async delete(id, userId) {
      const rows = await db
        .delete(webauthnCredentials)
        .where(and(eq(webauthnCredentials.id, id), eq(webauthnCredentials.userId, userId)))
        .returning({ id: webauthnCredentials.id });
      return rows.length > 0;
    },
  };
}

export function createPostgresBackupCodeStore(db: Db): BackupCodeStore {
  return {
    async replaceAll(userId, codeHashes) {
      await db.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, userId));
      if (codeHashes.length === 0) {
        return;
      }
      await db.insert(mfaBackupCodes).values(codeHashes.map((codeHash) => ({ userId, codeHash })));
    },

    async consume(userId, codeHash) {
      const [row] = await db
        .select()
        .from(mfaBackupCodes)
        .where(
          and(
            eq(mfaBackupCodes.userId, userId),
            eq(mfaBackupCodes.codeHash, codeHash),
            isNull(mfaBackupCodes.usedAt),
          ),
        )
        .limit(1);
      if (!row) {
        return false;
      }
      await db
        .update(mfaBackupCodes)
        .set({ usedAt: new Date() })
        .where(eq(mfaBackupCodes.id, row.id));
      return true;
    },

    async deleteAll(userId) {
      await db.delete(mfaBackupCodes).where(eq(mfaBackupCodes.userId, userId));
    },
  };
}

export function createPostgresStepUpStore(db: Db): StepUpStore {
  return {
    async create(input) {
      await db.insert(stepUpChallenges).values(input);
    },

    async consume(id, userId, sessionId) {
      const [row] = await db
        .select()
        .from(stepUpChallenges)
        .where(eq(stepUpChallenges.id, id))
        .limit(1);
      if (
        !row ||
        row.userId !== userId ||
        row.sessionId !== sessionId ||
        row.usedAt !== null ||
        row.expiresAt.getTime() <= Date.now()
      ) {
        return false;
      }
      await db
        .update(stepUpChallenges)
        .set({ usedAt: new Date() })
        .where(eq(stepUpChallenges.id, id));
      return true;
    },
  };
}

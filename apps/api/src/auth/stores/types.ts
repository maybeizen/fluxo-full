import type { AvatarSource, AuthTokenType, UserRole } from "@fluxo/types";

export interface UserRecord {
  id: string;
  username: string;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  avatarSource: AvatarSource;
  dateOfBirth: string | null;
  company: string | null;
  role: UserRole;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  suspendedAt: Date | null;
  suspendedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  emailVerifiedAt: Date | null;
  avatarUrl?: string | null;
  avatarSource?: AvatarSource;
  dateOfBirth?: string | null;
  company?: string | null;
  mfaEnabled?: boolean;
  mfaSecret?: string | null;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  username?: string;
  dateOfBirth?: string | null;
  company?: string | null;
  email?: string;
  emailVerifiedAt?: Date | null;
  avatarUrl?: string | null;
  avatarSource?: AvatarSource;
  passwordHash?: string;
  mfaEnabled?: boolean;
  mfaSecret?: string | null;
  role?: UserRole;
  suspendedAt?: Date | null;
  suspendedReason?: string | null;
}

export interface UserStore {
  count(): Promise<number>;
  countByRole(role: UserRole): Promise<number>;
  list(): Promise<UserRecord[]>;
  create(input: CreateUserInput): Promise<UserRecord>;
  findById(id: string): Promise<UserRecord | null>;
  findByUsername(username: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  update(id: string, input: UpdateUserInput): Promise<UserRecord | null>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  markEmailVerified(id: string): Promise<void>;
  updateMfa(
    id: string,
    input: { mfaEnabled: boolean; mfaSecret: string | null },
  ): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface SessionRecord {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  lastSeenAt: Date;
  userAgent: string | null;
  ip: string | null;
  mfaVerifiedAt: Date | null;
}

export interface SessionCacheRecord {
  userId: string;
  mfaVerified: boolean;
  expiresAt: string;
}

export interface SessionDurableStore {
  insert(record: SessionRecord): Promise<void>;
  findById(id: string): Promise<SessionRecord | null>;
  listByUserId(userId: string): Promise<SessionRecord[]>;
  update(record: SessionRecord): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByUserId(userId: string): Promise<string[]>;
  deleteByUserIdExcept(userId: string, exceptId: string): Promise<string[]>;
}

export interface SessionCacheStore {
  get(id: string): Promise<SessionCacheRecord | null>;
  set(id: string, record: SessionCacheRecord, ttlSeconds: number): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface AuthTokenRecord {
  tokenHash: string;
  userId: string;
  type: AuthTokenType;
  expiresAt: Date;
  data?: string | null;
}

export interface AuthTokenStore {
  create(input: AuthTokenRecord): Promise<void>;
  consume(
    tokenHash: string,
    type: AuthTokenType,
  ): Promise<{ userId: string; data: string | null } | null>;
  deleteByUserIdAndType(userId: string, type: AuthTokenType): Promise<void>;
}

export interface PasskeyRecord {
  id: string;
  userId: string;
  name: string;
  publicKey: string;
  counter: number;
  transports: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface CreatePasskeyInput {
  id: string;
  userId: string;
  name: string;
  publicKey: string;
  counter: number;
  transports: string | null;
}

export interface PasskeyStore {
  listByUserId(userId: string): Promise<PasskeyRecord[]>;
  findById(id: string): Promise<PasskeyRecord | null>;
  hasForUser(userId: string): Promise<boolean>;
  create(input: CreatePasskeyInput): Promise<PasskeyRecord>;
  touch(id: string, counter: number): Promise<void>;
  delete(id: string, userId: string): Promise<boolean>;
}

export interface BackupCodeStore {
  replaceAll(userId: string, codeHashes: string[]): Promise<void>;
  consume(userId: string, codeHash: string): Promise<boolean>;
  deleteAll(userId: string): Promise<void>;
}

export interface StepUpStore {
  create(input: { id: string; userId: string; sessionId: string; expiresAt: Date }): Promise<void>;
  consume(id: string, userId: string, sessionId: string): Promise<boolean>;
}

export interface WebAuthnChallengeStore {
  set(key: string, challenge: string, ttlSeconds: number): Promise<void>;
  consume(key: string): Promise<string | null>;
}

export interface AuthConfig {
  nodeEnv: "development" | "test" | "production";
  bcryptRounds: number;
  appKey: string;
  appName: string;
  frontendUrl: string;
  apiUrl: string;
  storagePublicUrlBase?: string;
}

export interface SessionEngineConfig {
  secret: string;
  lifetimeDays: number;
  cookieDomain?: string;
  secure: boolean;
}

import type { FluxoDatabase } from "@fluxo/db";
import type { FluxoLogger } from "@fluxo/logger";
import type { Redis } from "@fluxo/redis";
import type { StorageDriver } from "@fluxo/s3";
import type { Env } from "../env.js";
import { envToSettingsSeed } from "../settings/env-seed.js";
import { loadSettingsRuntime, type SettingsRuntime } from "../settings/runtime.js";
import { createPostgresSettingsStore } from "../settings/store.js";
import { createSessionEngine, type SessionEngine } from "./session.js";
import {
  createPostgresBackupCodeStore,
  createPostgresPasskeyStore,
  createPostgresSessionStore,
  createPostgresStepUpStore,
  createPostgresTokenStore,
  createPostgresUserStore,
} from "./stores/postgres.js";
import { createRedisSessionCache, createRedisWebAuthnChallengeStore } from "./stores/redis.js";
import type {
  AuthConfig,
  AuthTokenStore,
  BackupCodeStore,
  PasskeyStore,
  StepUpStore,
  UserStore,
  WebAuthnChallengeStore,
} from "./stores/types.js";
import { createSimpleWebAuthnService, type WebAuthnService } from "./webauthn.js";

export interface AuthServices {
  users: UserStore;
  tokens: AuthTokenStore;
  sessions: SessionEngine;
  passkeys: PasskeyStore;
  backupCodes: BackupCodeStore;
  stepUps: StepUpStore;
  webauthnChallenges: WebAuthnChallengeStore;
  storage: StorageDriver;
  webauthn: WebAuthnService;
  config: AuthConfig;
  settings: SettingsRuntime;
}

export async function createAuthServices(options: {
  database: FluxoDatabase;
  redis: Redis;
  env: Env;
  settings?: SettingsRuntime;
  logger?: FluxoLogger;
}): Promise<AuthServices> {
  const db = options.database.db;
  const users = createPostgresUserStore(db);
  const tokens = createPostgresTokenStore(db);
  const config: AuthConfig = {
    nodeEnv: options.env.NODE_ENV,
    bcryptRounds: options.env.BCRYPT_ROUNDS,
    appKey: options.env.APP_KEY,
    appName: options.env.APP_NAME,
    frontendUrl: options.env.FRONTEND_URL,
    apiUrl: options.env.API_URL,
    storagePublicUrlBase: options.env.S3_PUBLIC_URL_BASE,
  };
  const sessions = createSessionEngine({
    durable: createPostgresSessionStore(db),
    cache: createRedisSessionCache(options.redis),
    config: {
      secret: options.env.SESSION_SECRET,
      lifetimeDays: options.env.SESSION_LIFETIME,
      cookieDomain: options.env.COOKIE_DOMAIN,
      secure: options.env.NODE_ENV === "production",
    },
  });
  const settings =
    options.settings ??
    (await loadSettingsRuntime({
      store: createPostgresSettingsStore(db),
      env: envToSettingsSeed(options.env),
      authConfig: config,
      logger: options.logger,
    }));

  return {
    users,
    tokens,
    sessions,
    passkeys: createPostgresPasskeyStore(db),
    backupCodes: createPostgresBackupCodeStore(db),
    stepUps: createPostgresStepUpStore(db),
    webauthnChallenges: createRedisWebAuthnChallengeStore(options.redis),
    storage: settings.storage,
    webauthn: createSimpleWebAuthnService(),
    config,
    settings,
  };
}

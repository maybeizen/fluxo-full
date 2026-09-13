export { assertDatabase, createDatabase } from "./client.js";
export type { FluxoDatabase } from "./client.js";
export { DatabaseConfigError, DatabasePingError } from "./errors.js";
export {
  authTokens,
  authTokenTypeEnum,
  avatarSourceEnum,
  fluxoMeta,
  mfaBackupCodes,
  sessions,
  stepUpChallenges,
  userRoleEnum,
  users,
  webauthnCredentials,
} from "./schema/index.js";
export * as schema from "./schema/index.js";

import { getTableColumns, getTableName } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  assertDatabase,
  authTokens,
  createDatabase,
  DatabaseConfigError,
  DatabasePingError,
  fluxoMeta,
  mfaBackupCodes,
  sessions,
  stepUpChallenges,
  users,
  webauthnCredentials,
} from "./index.js";

const { postgresMock, queryMock } = vi.hoisted(() => {
  const queryMock = Object.assign(vi.fn().mockResolvedValue([{ "?column?": 1 }]), {
    options: {
      parsers: {},
      serializers: {},
    },
  });
  const postgresMock = vi.fn(() => queryMock);
  return { postgresMock, queryMock };
});

vi.mock("postgres", () => ({
  default: postgresMock,
}));

describe("createDatabase", () => {
  beforeEach(() => {
    postgresMock.mockClear();
    queryMock.mockClear();
    queryMock.mockResolvedValue([{ "?column?": 1 }]);
  });

  it("creates a drizzle client from the configured url", () => {
    const result = createDatabase({ url: "postgres://localhost/fluxo" });
    expect(postgresMock).toHaveBeenCalledWith("postgres://localhost/fluxo");
    expect(result.db).toBeDefined();
    expect(result.client).toBe(queryMock);
    expect(typeof result.ping).toBe("function");
  });

  it("pings through the mocked postgres client", async () => {
    const { ping } = createDatabase({ url: "postgres://localhost/fluxo" });
    await ping();
    expect(queryMock).toHaveBeenCalled();
  });

  it("rejects an empty url", () => {
    expect(() => createDatabase({ url: "" })).toThrow(DatabaseConfigError);
    expect(() => createDatabase({ url: "   " })).toThrow(DatabaseConfigError);
  });
});

describe("assertDatabase", () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockResolvedValue([{ "?column?": 1 }]);
  });

  it("resolves when ping succeeds", async () => {
    const database = createDatabase({ url: "postgres://localhost/fluxo" });
    await expect(assertDatabase(database)).resolves.toBeUndefined();
  });

  it("throws a typed error when ping fails", async () => {
    queryMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const database = createDatabase({ url: "postgres://localhost/fluxo" });
    await expect(assertDatabase(database)).rejects.toBeInstanceOf(DatabasePingError);
  });
});

describe("schema", () => {
  it("defines the fluxo_meta table", () => {
    expect(getTableName(fluxoMeta)).toBe("fluxo_meta");
    const columns = getTableColumns(fluxoMeta);
    expect(columns.key).toBeDefined();
    expect(columns.value).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });

  it("defines the users table", () => {
    expect(getTableName(users)).toBe("users");
    const columns = getTableColumns(users);
    expect(columns.id).toBeDefined();
    expect(columns.username).toBeDefined();
    expect(columns.email).toBeDefined();
    expect(columns.emailVerifiedAt).toBeDefined();
    expect(columns.passwordHash).toBeDefined();
    expect(columns.firstName).toBeDefined();
    expect(columns.lastName).toBeDefined();
    expect(columns.avatarUrl).toBeDefined();
    expect(columns.avatarSource).toBeDefined();
    expect(columns.dateOfBirth).toBeDefined();
    expect(columns.company).toBeDefined();
    expect(columns.role).toBeDefined();
    expect(columns.mfaEnabled).toBeDefined();
    expect(columns.mfaSecret).toBeDefined();
    expect(columns.suspendedAt).toBeDefined();
    expect(columns.suspendedReason).toBeDefined();
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });

  it("defines the sessions table", () => {
    expect(getTableName(sessions)).toBe("sessions");
    const columns = getTableColumns(sessions);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.expiresAt).toBeDefined();
    expect(columns.createdAt).toBeDefined();
    expect(columns.lastSeenAt).toBeDefined();
    expect(columns.userAgent).toBeDefined();
    expect(columns.ip).toBeDefined();
    expect(columns.mfaVerifiedAt).toBeDefined();
  });

  it("defines the auth_tokens table", () => {
    expect(getTableName(authTokens)).toBe("auth_tokens");
    const columns = getTableColumns(authTokens);
    expect(columns.tokenHash).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.type).toBeDefined();
    expect(columns.data).toBeDefined();
    expect(columns.expiresAt).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });

  it("defines the webauthn_credentials table", () => {
    expect(getTableName(webauthnCredentials)).toBe("webauthn_credentials");
    const columns = getTableColumns(webauthnCredentials);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.name).toBeDefined();
    expect(columns.publicKey).toBeDefined();
    expect(columns.counter).toBeDefined();
    expect(columns.transports).toBeDefined();
    expect(columns.createdAt).toBeDefined();
    expect(columns.lastUsedAt).toBeDefined();
  });

  it("defines the mfa_backup_codes table", () => {
    expect(getTableName(mfaBackupCodes)).toBe("mfa_backup_codes");
    const columns = getTableColumns(mfaBackupCodes);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.codeHash).toBeDefined();
    expect(columns.usedAt).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });

  it("defines the step_up_challenges table", () => {
    expect(getTableName(stepUpChallenges)).toBe("step_up_challenges");
    const columns = getTableColumns(stepUpChallenges);
    expect(columns.id).toBeDefined();
    expect(columns.userId).toBeDefined();
    expect(columns.sessionId).toBeDefined();
    expect(columns.expiresAt).toBeDefined();
    expect(columns.usedAt).toBeDefined();
    expect(columns.createdAt).toBeDefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  assertNoPrototypePollution,
  ForgeValidationError,
  isSafeRelativeEntry,
  isSafeStorageKey,
  REDACTED,
  redactHeaders,
} from "./index.js";

describe("security helpers", () => {
  it("rejects forbidden keys", () => {
    expect(() => assertNoPrototypePollution({ __proto__: { a: 1 } })).toThrow(
      ForgeValidationError,
    );
    expect(() => assertNoPrototypePollution({ constructor: {} })).toThrow(
      ForgeValidationError,
    );
    expect(() =>
      assertNoPrototypePollution({ nested: { prototype: {} } }),
    ).toThrow(ForgeValidationError);
    expect(() =>
      assertNoPrototypePollution({ ok: true, items: [1, { a: 2 }] }),
    ).not.toThrow();
  });

  it("rejects unsafe relative entries and storage keys", () => {
    expect(isSafeRelativeEntry("dist/index.js")).toBe(true);
    expect(isSafeRelativeEntry("../x.js")).toBe(false);
    expect(isSafeRelativeEntry("/abs.js")).toBe(false);
    expect(isSafeStorageKey("state/servers.json")).toBe(true);
    expect(isSafeStorageKey("../etc/passwd")).toBe(false);
  });

  it("redacts auth headers without mutating the source", () => {
    const headers = {
      Authorization: "Bearer secret",
      Accept: "application/json",
    };
    expect(redactHeaders(headers)).toEqual({
      Authorization: REDACTED,
      Accept: "application/json",
    });
    expect(headers.Authorization).toBe("Bearer secret");
  });
});

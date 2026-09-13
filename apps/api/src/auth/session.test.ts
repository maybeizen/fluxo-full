import { describe, expect, it } from "vitest";
import {
  decodeSessionCookie,
  encodeSessionCookie,
  hashSessionId,
  SESSION_COOKIE_NAME,
} from "./cookie.js";
import { createSessionEngine, SessionConfigError } from "./session.js";
import { createMemorySessionCache, createMemorySessionStore } from "./stores/memory.js";

const secret = "test-session-secret-32-bytes-minimum!!";

function engine() {
  const durable = createMemorySessionStore();
  const cache = createMemorySessionCache();
  return {
    durable,
    cache,
    sessions: createSessionEngine({
      durable,
      cache,
      config: { secret, lifetimeDays: 7, secure: false },
    }),
  };
}

describe("session cookies", () => {
  it("signs and verifies opaque session ids", () => {
    const cookie = encodeSessionCookie("abc123", secret);
    expect(cookie).toContain(".");
    expect(decodeSessionCookie(cookie, secret)).toBe("abc123");
    expect(decodeSessionCookie(cookie, "other-secret")).toBeNull();
    expect(decodeSessionCookie("not-a-cookie", secret)).toBeNull();
  });

  it("hashes the raw id for storage", () => {
    expect(hashSessionId("abc123")).toHaveLength(64);
    expect(hashSessionId("abc123")).not.toBe("abc123");
  });
});

describe("createSessionEngine", () => {
  it("rejects an empty session secret", () => {
    expect(() =>
      createSessionEngine({
        durable: createMemorySessionStore(),
        cache: createMemorySessionCache(),
        config: { secret: "", lifetimeDays: 7, secure: false },
      }),
    ).toThrow(SessionConfigError);
  });

  it("writes through to postgres and redis on create", async () => {
    const { durable, cache, sessions } = engine();
    const cookie = await sessions.create({
      userId: "user-1",
      mfaVerified: true,
      rememberMe: true,
    });
    const resolved = await sessions.resolve(cookie);
    expect(resolved).not.toBeNull();
    if (!resolved) {
      return;
    }
    expect(resolved.userId).toBe("user-1");
    expect(resolved.mfaVerified).toBe(true);
    expect(await durable.findById(resolved.id)).not.toBeNull();
    expect(await cache.get(resolved.id)).not.toBeNull();
  });

  it("rehydrates from postgres when redis misses", async () => {
    const { cache, sessions } = engine();
    const cookie = await sessions.create({
      userId: "user-2",
      mfaVerified: true,
      rememberMe: false,
    });
    const first = await sessions.resolve(cookie);
    expect(first).not.toBeNull();
    if (!first) {
      return;
    }
    await cache.delete(first.id);
    expect(await cache.get(first.id)).toBeNull();

    const second = await sessions.resolve(cookie);
    expect(second?.userId).toBe("user-2");
    expect(await cache.get(first.id)).not.toBeNull();
  });

  it("destroys both stores on logout", async () => {
    const { durable, cache, sessions } = engine();
    const cookie = await sessions.create({
      userId: "user-3",
      mfaVerified: true,
      rememberMe: true,
    });
    const resolved = await sessions.resolve(cookie);
    expect(resolved).not.toBeNull();
    if (!resolved) {
      return;
    }
    await sessions.destroy(cookie);
    expect(await sessions.resolve(cookie)).toBeNull();
    expect(await durable.findById(resolved.id)).toBeNull();
    expect(await cache.get(resolved.id)).toBeNull();
  });

  it("uses the locked cookie name", () => {
    expect(SESSION_COOKIE_NAME).toBe("fluxo.sid");
  });
});

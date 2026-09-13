import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertRedis, createRedis, RedisConfigError, RedisPingError } from "./index.js";

const { pingMock, RedisMock } = vi.hoisted(() => {
  const pingMock = vi.fn();

  class RedisMock {
    url: string;

    constructor(url: string) {
      this.url = url;
    }

    ping = pingMock;
  }

  return { pingMock, RedisMock };
});

vi.mock("ioredis", () => ({
  Redis: RedisMock,
}));

describe("createRedis", () => {
  beforeEach(() => {
    pingMock.mockReset();
  });

  it("throws a typed error when the url is missing", () => {
    expect(() => createRedis({ url: "" })).toThrow(RedisConfigError);
    expect(() => createRedis({ url: "   " })).toThrow(RedisConfigError);
  });

  it("constructs a client when the url is present", () => {
    const redis = createRedis({ url: "redis://localhost:6379" });
    expect(redis).toBeInstanceOf(RedisMock);
  });
});

describe("assertRedis", () => {
  beforeEach(() => {
    pingMock.mockReset();
  });

  it("resolves when ping returns PONG", async () => {
    pingMock.mockResolvedValue("PONG");
    const redis = createRedis({ url: "redis://localhost:6379" });
    await expect(assertRedis(redis)).resolves.toBeUndefined();
  });

  it("throws a typed error when ping fails", async () => {
    pingMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const redis = createRedis({ url: "redis://localhost:6379" });
    await expect(assertRedis(redis)).rejects.toBeInstanceOf(RedisPingError);
  });

  it("throws a typed error when ping does not return PONG", async () => {
    pingMock.mockResolvedValue("NOPE");
    const redis = createRedis({ url: "redis://localhost:6379" });
    await expect(assertRedis(redis)).rejects.toBeInstanceOf(RedisPingError);
  });
});

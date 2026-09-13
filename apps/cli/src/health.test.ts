import type { FluxoLogger } from "@fluxo/logger";
import { describe, expect, it, vi } from "vitest";
import { runHealth } from "./health.js";

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

describe("runHealth", () => {
  it("logs local process info without calling the API", async () => {
    const logger = mockLogger();
    const fetchFn = vi.fn();
    await runHealth({ logger, apiUrl: "", fetchFn });
    expect(logger.info).toHaveBeenCalledWith(
      "local process",
      expect.objectContaining({
        pid: process.pid,
        node: process.version,
      }),
    );
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("reads API_URL from the environment when no option is passed", async () => {
    const previous = process.env.API_URL;
    process.env.API_URL = "http://localhost:3000";
    const logger = mockLogger();
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "{}",
    });

    try {
      await runHealth({ logger, fetchFn });
      expect(fetchFn).toHaveBeenCalledWith("http://localhost:3000/health");
    } finally {
      if (previous === undefined) {
        delete process.env.API_URL;
      } else {
        process.env.API_URL = previous;
      }
    }
  });

  it("fetches API_URL/health when an API URL is provided", async () => {
    const logger = mockLogger();
    const fetchFn = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ status: "ok", service: "api" }),
    });

    await runHealth({
      logger,
      apiUrl: "http://localhost:3000",
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith("http://localhost:3000/health");
    expect(logger.info).toHaveBeenCalledWith(
      "api health",
      expect.objectContaining({
        url: "http://localhost:3000/health",
        status: 200,
        body: { status: "ok", service: "api" },
      }),
    );
  });

  it("logs an error when the API health request fails", async () => {
    const logger = mockLogger();
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await runHealth({
      logger,
      apiUrl: "http://localhost:3000/",
      fetchFn,
    });

    expect(logger.error).toHaveBeenCalledWith(
      "ECONNREFUSED",
      expect.objectContaining({ url: "http://localhost:3000/health" }),
    );
  });
});

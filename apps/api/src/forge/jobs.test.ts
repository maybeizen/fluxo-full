import { ForgePermissionError, type PluginLogger } from "@fluxo/forge";
import { afterEach, describe, expect, it } from "vitest";
import {
  createJobScheduler,
  createPluginJobs,
  type JobScheduler,
} from "./jobs.js";

function silentLogger(): PluginLogger {
  const logger: PluginLogger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return logger;
    },
  };
  return logger;
}

const schedulers: JobScheduler[] = [];

afterEach(async () => {
  await Promise.all(
    schedulers.splice(0).map((scheduler) => scheduler.stopAll()),
  );
});

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 800,
): Promise<void> {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("timed out");
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("plugin jobs", () => {
  it("isolates a throwing job so other jobs still run", async () => {
    const scheduler = createJobScheduler({
      logger: silentLogger(),
      isPluginEnabled: () => true,
      retryDelayMs: 10,
      maxRetries: 1,
    });
    schedulers.push(scheduler);
    const jobs = createPluginJobs({
      pluginId: "acme.demo",
      permissions: ["jobs.schedule"],
      scheduler,
    });
    let ok = 0;
    jobs.handle("boom", () => {
      throw new Error("job boom");
    });
    jobs.handle("ok", () => {
      ok += 1;
    });
    await jobs.schedule({ name: "boom", delayMs: 0, payload: { n: 1 } });
    await jobs.schedule({ name: "ok", delayMs: 15 });
    await waitFor(() => ok === 1);
    expect(ok).toBe(1);
  });

  it("does not run jobs for a disabled plugin", async () => {
    const scheduler = createJobScheduler({
      logger: silentLogger(),
      isPluginEnabled: () => false,
    });
    schedulers.push(scheduler);
    const jobs = createPluginJobs({
      pluginId: "acme.demo",
      permissions: ["jobs.schedule"],
      scheduler,
    });
    let ran = 0;
    jobs.handle("tick", () => {
      ran += 1;
    });
    await jobs.schedule({ name: "tick", delayMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(ran).toBe(0);
  });

  it("denies schedule without permission", async () => {
    const scheduler = createJobScheduler({
      logger: silentLogger(),
      isPluginEnabled: () => true,
    });
    schedulers.push(scheduler);
    const jobs = createPluginJobs({
      pluginId: "acme.demo",
      permissions: [],
      scheduler,
    });
    await expect(jobs.schedule({ name: "tick" })).rejects.toBeInstanceOf(
      ForgePermissionError,
    );
    expect(() => jobs.handle("tick", () => undefined)).toThrow(
      ForgePermissionError,
    );
  });
});

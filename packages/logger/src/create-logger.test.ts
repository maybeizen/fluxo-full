import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { LogLevel } from "@fluxo/types";
import { afterEach, describe, expect, it } from "vitest";
import { createLogger } from "./index.js";

async function waitForLog(filePath: string, snippet: string): Promise<string> {
  const deadline = Date.now() + 2000;
  let last = "";
  while (Date.now() < deadline) {
    try {
      last = await readFile(filePath, "utf8");
      if (last.includes(snippet)) {
        return last;
      }
    } catch {
      last = "";
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }
  return last;
}

describe("createLogger", () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function tempDir(): Promise<string> {
    const dir = await mkdtemp(path.join(tmpdir(), "fluxo-logger-"));
    dirs.push(dir);
    return dir;
  }

  it("writes error messages to a file under os.tmpdir()", async () => {
    const directory = await tempDir();
    const logger = createLogger({ service: "api", directory, level: LogLevel.Error });
    logger.error("disk write failed");
    const content = await waitForLog(path.join(directory, "api.log"), "disk write failed");
    expect(content).toContain("disk write failed");
    expect(content).toContain("error");
    expect(directory.startsWith(tmpdir())).toBe(true);
  });

  it("includes the error message in the log output", async () => {
    const directory = await tempDir();
    const logger = createLogger({ service: "worker", directory, level: LogLevel.Debug });
    const message = "connection refused";
    logger.error(message);
    const content = await waitForLog(path.join(directory, "worker.log"), message);
    expect(content).toContain(message);
  });

  it("writes child bindings to the same file", async () => {
    const directory = await tempDir();
    const logger = createLogger({ service: "api", directory, level: LogLevel.Info });
    logger.child({ requestId: "req-1" }).info("accepted");
    const content = await waitForLog(path.join(directory, "api.log"), "accepted");
    expect(content).toContain("accepted");
    expect(content).toContain("req-1");
  });

  it("does not create cwd/logs when directory is omitted", async () => {
    const directory = await tempDir();
    const previous = process.cwd();
    process.chdir(directory);
    try {
      createLogger({ service: "console-only", level: LogLevel.Error }).error("no file");
      expect(existsSync(path.join(directory, "logs"))).toBe(false);
    } finally {
      process.chdir(previous);
    }
  });
});

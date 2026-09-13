import { chmod, lstat, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import type { FluxoLogger } from "@fluxo/logger";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleSettingsGet,
  handleSettingsList,
  handleSettingsSet,
  resolveSettingsPath,
  writeSettings,
} from "./settings.js";

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

function loggedPayloads(logger: FluxoLogger): string {
  return [logger.debug, logger.info, logger.warn, logger.error]
    .flatMap((fn) => vi.mocked(fn).mock.calls)
    .map((call) => JSON.stringify(call))
    .join("\n");
}

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "fluxo-cli-"));
  dirs.push(dir);
  return dir;
}

async function tempFile(): Promise<string> {
  return path.join(await tempDir(), "settings.json");
}

describe("resolveSettingsPath", () => {
  it("uses FLUXO_CONFIG_PATH when set", () => {
    expect(resolveSettingsPath({ FLUXO_CONFIG_PATH: "/tmp/fluxo.json" })).toBe("/tmp/fluxo.json");
  });

  it("defaults to ~/.fluxo/settings.json", () => {
    expect(resolveSettingsPath({})).toBe(path.join(homedir(), ".fluxo", "settings.json"));
  });
});

describe("writeSettings", () => {
  it("creates the file with mode 0600", async () => {
    const filePath = await tempFile();
    await writeSettings(filePath, { theme: "dark" });
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
    const stored = JSON.parse(await readFile(filePath, "utf8")) as Record<string, string>;
    expect(stored.theme).toBe("dark");
  });

  it("replaces an existing world-readable file with mode 0600", async () => {
    const filePath = await tempFile();
    await writeFile(filePath, "{}\n", { mode: 0o644 });
    await chmod(filePath, 0o644);
    await writeSettings(filePath, { theme: "dark" });
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
  });

  it("does not write through a symlink", async () => {
    const dir = await tempDir();
    const target = path.join(dir, "secret-target");
    await writeFile(target, "untouched\n", { mode: 0o600 });
    const filePath = path.join(dir, "settings.json");
    await symlink(target, filePath);

    await writeSettings(filePath, { token: "leaked" });

    expect(await readFile(target, "utf8")).toBe("untouched\n");
    expect((await lstat(filePath)).isSymbolicLink()).toBe(false);
    const stored = JSON.parse(await readFile(filePath, "utf8")) as Record<string, string>;
    expect(stored.token).toBe("leaked");
    expect((await stat(filePath)).mode & 0o777).toBe(0o600);
  });
});

describe("settings handlers", () => {
  it("sets, lists, and gets values from the JSON file", async () => {
    const filePath = await tempFile();
    const logger = mockLogger();

    await handleSettingsSet(logger, filePath, "theme", "dark");
    const stored = JSON.parse(await readFile(filePath, "utf8")) as Record<string, string>;
    expect(stored.theme).toBe("dark");
    expect(logger.info).toHaveBeenCalledWith("setting updated", { key: "theme" });

    await handleSettingsList(logger, filePath);
    expect(logger.info).toHaveBeenCalledWith("settings", { keys: ["theme"], count: 1 });

    await handleSettingsGet(logger, filePath, "theme");
    expect(logger.info).toHaveBeenCalledWith("setting", { key: "theme" });
    expect(loggedPayloads(logger)).not.toContain("dark");
  });

  it("does not log setting values", async () => {
    const filePath = await tempFile();
    const logger = mockLogger();
    const secret = "super-secret-token";

    await handleSettingsSet(logger, filePath, "token", secret);
    await handleSettingsList(logger, filePath);
    await handleSettingsGet(logger, filePath, "token");

    expect(loggedPayloads(logger)).not.toContain(secret);
    expect(logger.info).toHaveBeenCalledWith("settings", { keys: ["token"], count: 1 });
    expect(logger.info).toHaveBeenCalledWith("setting", { key: "token" });
  });

  it("warns when a setting is missing", async () => {
    const filePath = await tempFile();
    const logger = mockLogger();
    await handleSettingsGet(logger, filePath, "missing");
    expect(logger.warn).toHaveBeenCalledWith("setting not found", { key: "missing" });
  });
});

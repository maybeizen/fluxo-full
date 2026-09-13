import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FluxoLogger } from "@fluxo/logger";
import { PluginStatus } from "@fluxo/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPluginManager } from "./create-manager.js";
import { PluginNotFoundError, PluginNotLoadableError } from "./errors.js";

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

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "fluxo-plugins-"));
  dirs.push(dir);
  return dir;
}

async function writePlugin(directory: string, fileName: string, source: string): Promise<string> {
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, source, "utf8");
  return filePath;
}

describe("createPluginManager", () => {
  it("loads a valid plugin, isolates onLoad failures, and rejects invalid manifests", async () => {
    const directory = await tempDir();
    await writePlugin(
      directory,
      "valid.js",
      `export default {
  manifest: { id: "valid", name: "Valid", version: "1.0.0", description: "ok" },
  async onLoad() {},
};`,
    );
    await writePlugin(
      directory,
      "throws.js",
      `export default {
  manifest: { id: "throws", name: "Throws", version: "1.0.0" },
  async onLoad() {
    throw new Error("onLoad failed");
  },
};`,
    );
    await writePlugin(
      directory,
      "invalid.js",
      `export default {
  manifest: { name: "Missing id" },
};`,
    );

    const manager = createPluginManager({ directory, logger: mockLogger() });
    const results = await manager.loadAll();

    expect(results).toHaveLength(3);

    const valid = results.find((result) => result.id === "valid");
    const throws = results.find((result) => result.id === "throws");
    const invalid = results.find((result) => result.id === "invalid");

    expect(valid?.ok).toBe(true);
    expect(valid?.state.status).toBe(PluginStatus.Loaded);
    expect(throws?.ok).toBe(false);
    expect(throws?.error).toContain("onLoad failed");
    expect(throws?.state.status).toBe(PluginStatus.Error);
    expect(invalid?.ok).toBe(false);
    expect(invalid?.state.status).toBe(PluginStatus.Error);
    expect(invalid?.error).toBeDefined();

    const listed = manager.list();
    expect(listed).toHaveLength(3);
    expect(listed.some((plugin) => plugin.id === "valid" && plugin.status === PluginStatus.Loaded)).toBe(
      true,
    );

    await manager.enable("throws");
    expect(manager.list().find((plugin) => plugin.id === "throws")?.status).toBe(PluginStatus.Error);

    await expect(manager.enable("invalid")).rejects.toBeInstanceOf(PluginNotLoadableError);
    await expect(manager.disable("invalid")).rejects.toBeInstanceOf(PluginNotLoadableError);
    expect(manager.list().find((plugin) => plugin.id === "invalid")?.status).toBe(PluginStatus.Error);
  });

  it("does not call onEnable after an onLoad failure", async () => {
    const directory = await tempDir();
    const hookLog = path.join(directory, "hooks.log");
    await writePlugin(
      directory,
      "throws.js",
      `import { appendFileSync } from "node:fs";
export default {
  manifest: { id: "throws", name: "Throws", version: "1.0.0" },
  async onLoad() {
    appendFileSync(${JSON.stringify(hookLog)}, "onLoad\\n");
    throw new Error("onLoad failed");
  },
  async onEnable() {
    appendFileSync(${JSON.stringify(hookLog)}, "onEnable\\n");
  },
};`,
    );

    const manager = createPluginManager({ directory, logger: mockLogger() });
    await manager.loadAll();
    await manager.enable("throws");

    expect(manager.list()[0]?.status).toBe(PluginStatus.Error);
    const hooks = await readFile(hookLog, "utf8");
    expect(hooks).toBe("onLoad\n");
  });

  it("enables and disables a loaded plugin", async () => {
    const directory = await tempDir();
    await writePlugin(
      directory,
      "demo.js",
      `export default {
  manifest: { id: "demo", name: "Demo", version: "2.0.0" },
};`,
    );

    const manager = createPluginManager({ directory, logger: mockLogger() });
    await manager.loadAll();
    await manager.enable("demo");
    expect(manager.list()[0]?.status).toBe(PluginStatus.Enabled);

    await manager.disable("demo");
    expect(manager.list()[0]?.status).toBe(PluginStatus.Disabled);
  });

  it("refreshes a single plugin and the whole directory", async () => {
    const directory = await tempDir();
    const hookLog = path.join(directory, "hooks.log");
    await writePlugin(
      directory,
      "alpha.js",
      `import { appendFileSync } from "node:fs";
export default {
  manifest: { id: "alpha", name: "Alpha", version: "1.0.0" },
  async onDisable() {
    appendFileSync(${JSON.stringify(hookLog)}, "onDisable\\n");
  },
  async onUnload() {
    appendFileSync(${JSON.stringify(hookLog)}, "onUnload\\n");
  },
};`,
    );

    const manager = createPluginManager({ directory, logger: mockLogger() });
    await manager.loadAll();
    await manager.enable("alpha");
    expect(manager.list()[0]?.status).toBe(PluginStatus.Enabled);

    await manager.refresh("alpha");
    expect(manager.list()[0]?.status).toBe(PluginStatus.Loaded);
    expect(await readFile(hookLog, "utf8")).toBe("onDisable\nonUnload\n");

    await writePlugin(
      directory,
      "beta.js",
      `export default {
  manifest: { id: "beta", name: "Beta", version: "1.0.0" },
};`,
    );
    await manager.enable("alpha");
    await manager.refresh();
    const ids = manager.list().map((plugin) => plugin.id).sort();
    expect(ids).toEqual(["alpha", "beta"]);
    expect(await readFile(hookLog, "utf8")).toBe("onDisable\nonUnload\nonDisable\nonUnload\n");
  });

  it("throws when enabling an unknown plugin", async () => {
    const directory = await tempDir();
    const manager = createPluginManager({ directory, logger: mockLogger() });
    await manager.loadAll();
    await expect(manager.enable("missing")).rejects.toBeInstanceOf(PluginNotFoundError);
  });
});

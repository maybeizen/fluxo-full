import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FORGE_API_VERSION,
  ForgeConflictError,
  ForgeUnsupportedApiError,
} from "@fluxo/forge";
import { afterEach, describe, expect, it } from "vitest";
import { createPluginManager } from "./create-manager.js";
import { PluginNotFoundError, PluginNotLoadableError } from "./errors.js";
import { createFakeLogger, createFakePluginContext } from "./fake-context.js";
import { createMemoryInstallStore } from "./install-state.js";
import type { PluginInstallState, PluginManager } from "./types.js";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "fluxo-plugins-"));
  dirs.push(dir);
  return dir;
}

function baseManifest(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    version: "1.0.0",
    type: "service",
    forgeApi: `^${FORGE_API_VERSION}`,
    entry: "index.js",
    ...extra,
  };
}

function pluginSource(manifest: unknown, body = ""): string {
  return `export default {
  manifest: ${JSON.stringify(manifest)},
  ${body}
};
`;
}

async function writePluginPackage(
  directory: string,
  id: string,
  options: {
    manifest?: Record<string, unknown>;
    source?: string;
    entry?: string;
    skipEntry?: boolean;
  } = {},
): Promise<string> {
  const root = path.join(directory, id);
  await mkdir(root, { recursive: true });
  const manifest = baseManifest(id, {
    ...(options.entry ? { entry: options.entry } : {}),
    ...options.manifest,
  });
  await writeFile(
    path.join(root, "plugin.json"),
    JSON.stringify(manifest),
    "utf8",
  );
  if (!options.skipEntry) {
    const entry = String(manifest.entry);
    const entryPath = path.join(root, entry);
    await mkdir(path.dirname(entryPath), { recursive: true });
    const source = options.source ?? pluginSource(manifest);
    await writeFile(entryPath, source, "utf8");
  }
  return root;
}

function createManager(
  directory: string,
  install?: Readonly<Record<string, PluginInstallState>>,
): PluginManager {
  const store = createMemoryInstallStore(install);
  const logger = createFakeLogger();
  return createPluginManager({
    directory,
    logger,
    createContext: (pluginId) => createFakePluginContext(pluginId, logger),
    getInstallState: store.getInstallState,
    setInstallState: store.setInstallState,
  });
}

describe("createPluginManager discovery", () => {
  it("loads a valid plugin without starting it when not enabled", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "valid");
    const manager = createManager(directory);
    const results = await manager.loadAll();
    expect(results).toHaveLength(1);
    expect(results[0]?.ok).toBe(true);
    expect(results[0]?.definition?.status).toBe("disabled");
    expect(manager.listActive()).toEqual([]);
    expect(manager.getActive("valid")).toBeUndefined();
  });

  it("starts enabled plugins on boot and skips disabled ones", async () => {
    const directory = await tempDir();
    const log = path.join(directory, "hooks.log");
    const hooks = `
      async onInstall() { throw new Error("install should not run"); },
      async onEnable() { throw new Error("enable should not run"); },
      async onStart(ctx) { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "start:" + ctx.pluginId + "\\n")); },
    `;
    await writePluginPackage(directory, "alpha", {
      source: pluginSource(baseManifest("alpha"), hooks),
    });
    await writePluginPackage(directory, "beta", {
      source: pluginSource(baseManifest("beta"), hooks),
    });
    const manager = createManager(directory, {
      alpha: { installed: true, enabled: true },
      beta: { installed: true, enabled: false },
    });
    await manager.loadAll();
    expect(manager.getActive("alpha")?.manifest.id).toBe("alpha");
    expect(manager.getActive("beta")).toBeUndefined();
    expect(manager.list().find((item) => item.id === "alpha")?.status).toBe(
      "started",
    );
    expect(manager.list().find((item) => item.id === "beta")?.status).toBe(
      "installed",
    );
    expect(await readFile(log, "utf8")).toBe("start:alpha\n");
  });

  it("rejects invalid plugin directory ids without crashing", async () => {
    const directory = await tempDir();
    await mkdir(path.join(directory, "InvalidId"));
    await writeFile(
      path.join(directory, "InvalidId", "plugin.json"),
      JSON.stringify(baseManifest("invalid")),
      "utf8",
    );
    await mkdir(path.join(directory, "foo_bar"));
    await writePluginPackage(directory, "okplugin");
    const manager = createManager(directory);
    const results = await manager.loadAll();
    expect(
      results.some(
        (result) => result.id === "InvalidId" && result.ok === false,
      ),
    ).toBe(true);
    expect(
      results.some((result) => result.id === "foo_bar" && result.ok === false),
    ).toBe(true);
    expect(results.find((result) => result.id === "okplugin")?.ok).toBe(true);
  });

  it("rejects path traversal in manifest entry", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "escape", {
      manifest: { entry: "../secret.js" },
      skipEntry: true,
    });
    const manager = createManager(directory);
    const results = await manager.loadAll();
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.error).toBeDefined();
    expect(manager.getActive("escape")).toBeUndefined();
  });

  it("rejects a symlink entry that escapes the plugin root", async () => {
    const directory = await tempDir();
    const root = await writePluginPackage(directory, "linked", {
      manifest: { entry: "link.js" },
      skipEntry: true,
    });
    const outside = path.join(directory, "outside.js");
    await writeFile(outside, pluginSource(baseManifest("linked")), "utf8");
    await symlink(outside, path.join(root, "link.js"));
    const manager = createManager(directory);
    const results = await manager.loadAll();
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.error).toMatch(
      /escapes plugin root|Unsafe plugin entry/i,
    );
  });

  it("fails duplicate plugin ids and does not load either", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "alpha", {
      manifest: { id: "shared" },
    });
    await writePluginPackage(directory, "beta", {
      manifest: { id: "shared" },
    });
    const manager = createManager(directory);
    const results = await manager.loadAll();
    const duplicates = results.filter((result) => result.id === "shared");
    expect(duplicates.length).toBeGreaterThanOrEqual(2);
    expect(duplicates.every((result) => result.ok === false)).toBe(true);
    expect(
      duplicates.every((result) =>
        result.error?.includes("duplicate plugin id"),
      ),
    ).toBe(true);
    expect(manager.getActive("shared")).toBeUndefined();
    expect(manager.getActive("alpha")).toBeUndefined();
    await expect(manager.enable("shared")).rejects.toBeInstanceOf(
      PluginNotLoadableError,
    );
  });

  it("skips incompatible forgeApi plugins", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "oldapi", {
      manifest: { forgeApi: "^9.0.0" },
    });
    await writePluginPackage(directory, "keeper");
    const manager = createManager(directory);
    const results = await manager.loadAll();
    const old = results.find((result) => result.id === "oldapi");
    expect(old?.ok).toBe(false);
    expect(old?.error).toBe(
      new ForgeUnsupportedApiError("^9.0.0", FORGE_API_VERSION).message,
    );
    expect(results.find((result) => result.id === "keeper")?.ok).toBe(true);
    expect(manager.getActive("oldapi")).toBeUndefined();
  });

  it("isolates malformed manifests and missing plugin.json", async () => {
    const directory = await tempDir();
    await mkdir(path.join(directory, "broken"));
    await writeFile(path.join(directory, "broken", "plugin.json"), "{", "utf8");
    await mkdir(path.join(directory, "empty"));
    await writePluginPackage(directory, "okplugin");
    const manager = createManager(directory);
    const results = await manager.loadAll();
    expect(results.find((result) => result.id === "broken")?.ok).toBe(false);
    expect(results.find((result) => result.id === "broken")?.error).toMatch(
      /Malformed/,
    );
    expect(results.find((result) => result.id === "empty")?.ok).toBe(false);
    expect(results.find((result) => result.id === "empty")?.error).toMatch(
      /Missing plugin.json/,
    );
    expect(results.find((result) => result.id === "okplugin")?.ok).toBe(true);
  });

  it("rejects prototype-polluting manifests", async () => {
    const directory = await tempDir();
    const root = path.join(directory, "pollute");
    await mkdir(root, { recursive: true });
    await writeFile(
      path.join(root, "plugin.json"),
      `{"id":"pollute","name":"P","version":"1.0.0","type":"service","forgeApi":"^${FORGE_API_VERSION}","entry":"index.js","__proto__":{"name":"pwned"}}`,
      "utf8",
    );
    await writeFile(
      path.join(root, "index.js"),
      pluginSource(baseManifest("pollute")),
      "utf8",
    );
    const manager = createManager(directory);
    const results = await manager.loadAll();
    expect(results[0]?.ok).toBe(false);
    expect(results[0]?.error).toBeDefined();
  });

  it("isolates missing and invalid entrypoints", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "missing", { skipEntry: true });
    await writePluginPackage(directory, "invalid", {
      source: "export default { nope: true };\n",
    });
    await writePluginPackage(directory, "okplugin");
    const manager = createManager(directory);
    const results = await manager.loadAll();
    expect(results.find((result) => result.id === "missing")?.ok).toBe(false);
    expect(results.find((result) => result.id === "invalid")?.ok).toBe(false);
    expect(results.find((result) => result.id === "invalid")?.error).toMatch(
      /definePlugin/,
    );
    expect(results.find((result) => result.id === "okplugin")?.ok).toBe(true);
  });

  it("isolates import exceptions so other plugins still load", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "boom", {
      source: `throw new Error("boom at import");\n`,
    });
    await writePluginPackage(directory, "okplugin");
    const manager = createManager(directory);
    const results = await manager.loadAll();
    expect(results.find((result) => result.id === "boom")?.ok).toBe(false);
    expect(results.find((result) => result.id === "boom")?.error).toContain(
      "boom at import",
    );
    expect(results.find((result) => result.id === "okplugin")?.ok).toBe(true);
    expect(manager.list().some((item) => item.id === "okplugin")).toBe(true);
  });

  it("continues when the plugins directory is missing", async () => {
    const directory = path.join(await tempDir(), "does-not-exist");
    const manager = createManager(directory);
    await expect(manager.loadAll()).resolves.toEqual([]);
  });
});

describe("createPluginManager lifecycle", () => {
  it("runs install, enable, start, stop, disable, uninstall in order", async () => {
    const directory = await tempDir();
    const log = path.join(directory, "hooks.log");
    const body = `
      async onInstall() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "install\\n")); },
      async onEnable() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "enable\\n")); },
      async onStart() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "start\\n")); },
      async onStop() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "stop\\n")); },
      async onDisable() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "disable\\n")); },
      async onUninstall() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "uninstall\\n")); },
    `;
    await writePluginPackage(directory, "lifecycle", {
      source: pluginSource(baseManifest("lifecycle"), body),
    });
    const manager = createManager(directory);
    await manager.loadAll();
    expect(manager.listActive()).toEqual([]);
    await expect(readFile(log, "utf8")).rejects.toThrow();

    await manager.install("lifecycle");
    expect((await manager.getDefinition("lifecycle"))?.status).toBe(
      "installed",
    );
    await manager.enable("lifecycle");
    expect(manager.getActive("lifecycle")?.manifest.id).toBe("lifecycle");
    expect((await manager.getDefinition("lifecycle"))?.status).toBe("started");
    await manager.disable("lifecycle");
    expect(manager.getActive("lifecycle")).toBeUndefined();
    expect(manager.listActive()).toEqual([]);
    expect((await manager.getDefinition("lifecycle"))?.status).toBe("disabled");
    await manager.uninstall("lifecycle");
    expect((await manager.getDefinition("lifecycle"))?.status).toBe("disabled");
    expect(await readFile(log, "utf8")).toBe(
      "install\nenable\nstart\nstop\ndisable\nuninstall\n",
    );
  });

  it("maps legacy onLoad and onUnload aliases once", async () => {
    const directory = await tempDir();
    const log = path.join(directory, "hooks.log");
    const body = `
      async onLoad() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "load\\n")); },
      async onUnload() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "unload\\n")); },
    `;
    await writePluginPackage(directory, "legacy", {
      source: pluginSource(baseManifest("legacy"), body),
    });
    const manager = createManager(directory);
    await manager.loadAll();
    await manager.install("legacy");
    await manager.enable("legacy");
    await manager.disable("legacy");
    expect(await readFile(log, "utf8")).toBe("load\nunload\n");
  });

  it("does not call onLoad when onStart is defined", async () => {
    const directory = await tempDir();
    const log = path.join(directory, "hooks.log");
    const body = `
      async onLoad() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "load\\n")); },
      async onStart() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "start\\n")); },
    `;
    await writePluginPackage(directory, "both", {
      source: pluginSource(baseManifest("both"), body),
    });
    const manager = createManager(directory, {
      both: { installed: true, enabled: true },
    });
    await manager.loadAll();
    expect(await readFile(log, "utf8")).toBe("start\n");
  });

  it("removes runtime contributions after disable", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "contrib");
    const manager = createManager(directory);
    await manager.loadAll();
    await manager.install("contrib");
    await manager.enable("contrib");
    expect(manager.listActive().map((item) => item.id)).toEqual(["contrib"]);
    expect(manager.getActive("contrib")).toBeDefined();
    await manager.disable("contrib");
    expect(manager.listActive()).toEqual([]);
    expect(manager.getActive("contrib")).toBeUndefined();
    expect(
      (await manager.listDefinitions()).some((item) => item.id === "contrib"),
    ).toBe(true);
  });

  it("isolates onStart failures and still starts other plugins", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "throws", {
      source: pluginSource(
        baseManifest("throws"),
        `async onStart() { throw new Error("onStart failed"); },`,
      ),
    });
    await writePluginPackage(directory, "okplugin", {
      source: pluginSource(baseManifest("okplugin"), `async onStart() {},`),
    });
    const manager = createManager(directory, {
      throws: { installed: true, enabled: true },
      okplugin: { installed: true, enabled: true },
    });
    const results = await manager.loadAll();
    expect(results.find((result) => result.id === "throws")?.ok).toBe(false);
    expect(results.find((result) => result.id === "throws")?.error).toContain(
      "onStart failed",
    );
    expect(results.find((result) => result.id === "okplugin")?.ok).toBe(true);
    expect(manager.getActive("throws")).toBeUndefined();
    expect(manager.getActive("okplugin")).toBeDefined();
    await manager.enable("throws");
    expect(manager.list().find((item) => item.id === "throws")?.status).toBe(
      "error",
    );
  });

  it("does not call onEnable after an onStart failure", async () => {
    const directory = await tempDir();
    const log = path.join(directory, "hooks.log");
    await writePluginPackage(directory, "throws", {
      source: pluginSource(
        baseManifest("throws"),
        `
        async onStart() {
          await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "onStart\\n"));
          throw new Error("onStart failed");
        },
        async onEnable() {
          await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "onEnable\\n"));
        },
        `,
      ),
    });
    const manager = createManager(directory, {
      throws: { installed: true, enabled: true },
    });
    await manager.loadAll();
    await manager.enable("throws");
    expect(manager.list()[0]?.status).toBe("error");
    expect(await readFile(log, "utf8")).toBe("onStart\n");
  });

  it("throws when enabling an unknown plugin and when enabling a broken plugin", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "invalid", {
      source: "export default { nope: true };\n",
    });
    const manager = createManager(directory);
    await manager.loadAll();
    await expect(manager.enable("missing")).rejects.toBeInstanceOf(
      PluginNotFoundError,
    );
    await expect(manager.enable("invalid")).rejects.toBeInstanceOf(
      PluginNotLoadableError,
    );
    await expect(manager.disable("invalid")).rejects.toBeInstanceOf(
      PluginNotLoadableError,
    );
    await expect(manager.install("okplugin")).rejects.toBeInstanceOf(
      PluginNotFoundError,
    );
  });

  it("requires install before enable", async () => {
    const directory = await tempDir();
    await writePluginPackage(directory, "demo");
    const manager = createManager(directory);
    await manager.loadAll();
    await expect(manager.enable("demo")).rejects.toBeInstanceOf(
      ForgeConflictError,
    );
  });

  it("passes a host context without db handles", async () => {
    const directory = await tempDir();
    const log = path.join(directory, "ctx.log");
    await writePluginPackage(directory, "ctxcheck", {
      source: pluginSource(
        baseManifest("ctxcheck"),
        `
        async onStart(ctx) {
          if ("prisma" in ctx || "db" in ctx || "app" in ctx) {
            throw new Error("host internals leaked");
          }
          await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, ctx.pluginId));
        },
        `,
      ),
    });
    const manager = createManager(directory, {
      ctxcheck: { installed: true, enabled: true },
    });
    await manager.loadAll();
    expect(await readFile(log, "utf8")).toBe("ctxcheck");
  });

  it("stops started plugins on refresh without re-running install", async () => {
    const directory = await tempDir();
    const log = path.join(directory, "hooks.log");
    await writePluginPackage(directory, "alpha", {
      source: pluginSource(
        baseManifest("alpha"),
        `
        async onInstall() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "install\\n")); },
        async onEnable() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "enable\\n")); },
        async onStart() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "start\\n")); },
        async onStop() { await import("node:fs").then((fs) => fs.appendFileSync(${JSON.stringify(log)}, "stop\\n")); },
        `,
      ),
    });
    const manager = createManager(directory);
    await manager.loadAll();
    await manager.install("alpha");
    await manager.enable("alpha");
    await manager.refresh("alpha");
    expect(await readFile(log, "utf8")).toBe(
      "install\nenable\nstart\nstop\nstart\n",
    );
    expect(manager.getActive("alpha")).toBeDefined();
  });
});

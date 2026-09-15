import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  FORGE_API_VERSION,
  ForgePermissionError,
  type PluginLogger,
} from "@fluxo/forge";
import { afterEach, describe, expect, it } from "vitest";
import {
  createForgeHost,
  createInstallStateAdapter,
  installStateFromRow,
} from "./host.js";
import { createMemoryPluginPersist } from "./persist.js";

const manifest = {
  id: "acme.demo",
  name: "Demo",
  version: "1.2.3",
  type: "service" as const,
  forgeApi: "^0.1.0",
  entry: "index.js",
};

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

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

describe("install-state adapter", () => {
  it("maps a missing row to not installed", () => {
    expect(installStateFromRow(undefined)).toEqual({
      installed: false,
      enabled: false,
    });
  });

  it("maps row enabled true and false", async () => {
    const persist = createMemoryPluginPersist();
    const adapter = createInstallStateAdapter(persist);
    expect(await adapter.getInstallState("acme.demo")).toEqual({
      installed: false,
      enabled: false,
    });

    await persist.upsertInstall({
      id: "acme.demo",
      type: "service",
      version: "1.2.3",
      manifest,
      enabled: true,
    });
    expect(await adapter.getInstallState("acme.demo")).toEqual({
      installed: true,
      enabled: true,
    });

    await persist.setEnabled("acme.demo", false);
    expect(await adapter.getInstallState("acme.demo")).toEqual({
      installed: true,
      enabled: false,
    });
    expect(installStateFromRow(await persist.getInstall("acme.demo"))).toEqual({
      installed: true,
      enabled: false,
    });
  });

  it("writes enabled state back onto an existing install row", async () => {
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "acme.demo",
      type: "service",
      version: "1.2.3",
      manifest,
      enabled: false,
    });
    const adapter = createInstallStateAdapter(persist);
    await adapter.setInstallState("acme.demo", {
      installed: true,
      enabled: true,
    });
    expect((await persist.getInstall("acme.demo"))?.enabled).toBe(true);
    await adapter.setInstallState("acme.demo", {
      installed: false,
      enabled: false,
    });
    expect(await persist.getInstall("acme.demo")).toBeUndefined();
  });
});

describe("runtime permissions", () => {
  it("denies capabilities present only on the install row after a disk downgrade", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "fluxo-forge-host-"));
    dirs.push(directory);
    const pluginId = "acme.perms";
    const diskManifest = {
      id: pluginId,
      name: "Perms",
      version: "1.0.0",
      type: "service" as const,
      forgeApi: `^${FORGE_API_VERSION}`,
      entry: "index.js",
      permissions: ["storage.read"] as const,
    };
    const root = path.join(directory, pluginId);
    await mkdir(root, { recursive: true });
    await writeFile(
      path.join(root, "plugin.json"),
      JSON.stringify(diskManifest),
      "utf8",
    );
    await writeFile(
      path.join(root, "index.js"),
      `export default { manifest: ${JSON.stringify(diskManifest)} };\n`,
      "utf8",
    );

    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: pluginId,
      type: "service",
      version: "1.0.0",
      manifest: {
        ...diskManifest,
        permissions: ["storage.read", "storage.write"],
      },
      enabled: true,
      status: "enabled",
    });

    const host = createForgeHost({
      persist,
      logger: silentLogger(),
      pluginsDir: directory,
    });
    await host.manager.loadAll();
    const ctx = await host.createContext(pluginId);
    await expect(ctx.storage.get("state")).resolves.toBeUndefined();
    await expect(ctx.storage.set("state", 1)).rejects.toBeInstanceOf(
      ForgePermissionError,
    );
  });
});

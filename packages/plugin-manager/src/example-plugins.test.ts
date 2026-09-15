import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FORGE_API_VERSION,
  ForgeUnsupportedApiError,
  type FluxoGatewayPlugin,
  type FluxoPanelPlugin,
  type FluxoServicePlugin,
} from "@fluxo/forge";
import { afterEach, describe, expect, it } from "vitest";
import { createPluginManager } from "./create-manager.js";
import { createFakeLogger, createFakePluginContext } from "./fake-context.js";
import { createMemoryInstallStore } from "./install-state.js";
import type { PluginInstallState, PluginManager } from "./types.js";

const PLUGIN_IDS = [
  "example-gateway",
  "example-panel",
  "example-service",
] as const;
const WORKSPACE_PLUGINS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../plugins",
);

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "fluxo-example-plugins-"));
  dirs.push(dir);
  return dir;
}

function enabledInstalls(
  extra: Record<string, PluginInstallState> = {},
): Record<string, PluginInstallState> {
  return {
    "example-service": { installed: true, enabled: true },
    "example-gateway": { installed: true, enabled: true },
    "example-panel": { installed: true, enabled: true },
    ...extra,
  };
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

async function linkWorkspacePlugins(directory: string): Promise<void> {
  for (const id of PLUGIN_IDS) {
    await symlink(path.join(WORKSPACE_PLUGINS, id), path.join(directory, id));
  }
}

describe("workspace example plugins", () => {
  it("discovers and starts all three from the workspace plugins directory", async () => {
    const manager = createManager(WORKSPACE_PLUGINS, enabledInstalls());
    const results = await manager.loadAll();
    const byId = new Map(results.map((result) => [result.id, result]));

    for (const id of PLUGIN_IDS) {
      expect(byId.get(id)?.ok).toBe(true);
      expect(byId.get(id)?.definition?.status).toBe("started");
      expect(manager.getActive(id)?.manifest.id).toBe(id);
    }

    const service = manager.getActive("example-service") as
      FluxoServicePlugin | undefined;
    const gateway = manager.getActive("example-gateway") as
      FluxoGatewayPlugin | undefined;
    const panel = manager.getActive("example-panel") as
      FluxoPanelPlugin | undefined;
    expect(typeof service?.provision).toBe("function");
    expect(typeof service?.capabilities).toBe("function");
    expect(typeof gateway?.createCheckout).toBe("function");
    expect(typeof gateway?.getPaymentStatus).toBe("function");
    expect(panel?.contributions?.()).toEqual([
      {
        point: "admin.dashboard.widget",
        contributionId: "status",
        title: "Example",
        order: 50,
      },
    ]);
    expect(manager.listActive().map((item) => item.id)).toEqual(
      expect.arrayContaining([...PLUGIN_IDS]),
    );
  });

  it("does not crash when a malformed sibling folder is present", async () => {
    const directory = await tempDir();
    await linkWorkspacePlugins(directory);
    await mkdir(path.join(directory, "broken"));
    await writeFile(path.join(directory, "broken", "plugin.json"), "{", "utf8");
    await mkdir(path.join(directory, "NotValid"));
    await writeFile(
      path.join(directory, "NotValid", "plugin.json"),
      JSON.stringify({
        id: "notvalid",
        name: "Bad",
        version: "1.0.0",
        type: "service",
        forgeApi: `^${FORGE_API_VERSION}`,
        entry: "index.js",
      }),
      "utf8",
    );
    await mkdir(path.join(directory, "empty"));

    const manager = createManager(directory, enabledInstalls());
    const results = await manager.loadAll();
    const byId = new Map(results.map((result) => [result.id, result]));

    expect(byId.get("broken")?.ok).toBe(false);
    expect(byId.get("broken")?.error).toMatch(/Malformed/);
    expect(byId.get("NotValid")?.ok).toBe(false);
    expect(byId.get("empty")?.ok).toBe(false);
    expect(byId.get("example-service")?.ok).toBe(true);
    expect(byId.get("example-gateway")?.ok).toBe(true);
    expect(byId.get("example-panel")?.ok).toBe(true);
    expect(manager.getActive("example-service")).toBeDefined();
    expect(manager.getActive("broken")).toBeUndefined();
  });

  it("skips an incompatible forgeApi fixture without failing other plugins", async () => {
    const directory = await tempDir();
    await linkWorkspacePlugins(directory);
    const oldRoot = path.join(directory, "oldapi");
    await mkdir(oldRoot);
    await writeFile(
      path.join(oldRoot, "plugin.json"),
      JSON.stringify({
        id: "oldapi",
        name: "Old API",
        version: "1.0.0",
        type: "service",
        forgeApi: "^9.0.0",
        entry: "index.js",
      }),
      "utf8",
    );
    await writeFile(
      path.join(oldRoot, "index.js"),
      `export default { manifest: { id: "oldapi" } };\n`,
      "utf8",
    );

    const manager = createManager(directory, enabledInstalls());
    const results = await manager.loadAll();
    const old = results.find((result) => result.id === "oldapi");
    expect(old?.ok).toBe(false);
    expect(old?.error).toBe(
      new ForgeUnsupportedApiError("^9.0.0", FORGE_API_VERSION).message,
    );
    expect(manager.getActive("oldapi")).toBeUndefined();
    expect(manager.getActive("example-service")).toBeDefined();
    expect(manager.getActive("example-gateway")).toBeDefined();
    expect(manager.getActive("example-panel")).toBeDefined();
  });
});

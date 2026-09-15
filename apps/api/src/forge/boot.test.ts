import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { FORGE_API_VERSION, forgeWebhookPath, type PluginLogger } from "@fluxo/forge";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createMemoryAuth } from "../auth/stores/memory.js";
import { getForgeHost, startForge, stopForge } from "./boot.js";
import { createMemoryPluginPersist } from "./persist.js";

const dirs: string[] = [];

afterEach(async () => {
  await stopForge();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
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

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "fluxo-forge-boot-"));
  dirs.push(dir);
  return dir;
}

function manifest(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: id,
    version: "1.0.0",
    type: "service",
    forgeApi: `^${FORGE_API_VERSION}`,
    entry: "index.js",
    ...extra,
    id,
  };
}

async function writePlugin(
  directory: string,
  id: string,
  source: string,
  extra: Record<string, unknown> = {},
): Promise<ReturnType<typeof manifest>> {
  const pluginManifest = manifest(id, extra);
  const root = path.join(directory, id);
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, "plugin.json"), JSON.stringify(pluginManifest), "utf8");
  await writeFile(path.join(root, "index.js"), source, "utf8");
  return pluginManifest;
}

describe("startForge", () => {
  it("continues if one plugin fails to load", async () => {
    const directory = await tempDir();
    await writePlugin(directory, "acme.boom", `throw new Error("boom at import");\n`);
    await writePlugin(
      directory,
      "acme.ok",
      `export default { manifest: ${JSON.stringify(manifest("acme.ok"))} };\n`,
    );
    const persist = createMemoryPluginPersist();
    const host = await startForge({
      logger: silentLogger(),
      pluginsDir: directory,
      persist,
    });
    expect(getForgeHost()).toBe(host);
    const results = host.manager.list();
    expect(results.some((item) => item.id === "acme.ok")).toBe(true);
    expect(host.manager.list().find((item) => item.id === "acme.ok")?.status).not.toBe("error");
    expect(host.manager.getActive("acme.boom")).toBeUndefined();
    expect(host.manager.list().find((item) => item.id === "acme.boom")?.status).toBe("error");
    expect(host.persist).toBe(persist);
    expect(typeof host.createContext).toBe("function");
    expect(host.services).toBe(getForgeHost().services);
    expect(host.gateways).toBe(getForgeHost().gateways);
  });

  it("exposes a working service registry after boot", async () => {
    const directory = await tempDir();
    const pluginId = "acme.compute";
    const pluginManifest = manifest(pluginId);
    await writePlugin(
      directory,
      pluginId,
      `export default {
  manifest: ${JSON.stringify(pluginManifest)},
  capabilities() { return ["provision.create"]; },
  provisioningVariables() { return []; },
  async provision() { return { status: "ok", remoteId: "remote-1" }; },
};
`,
    );
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: pluginId,
      type: "service",
      version: "1.0.0",
      manifest: pluginManifest,
      enabled: true,
    });
    const instance = await persist.createInstance({
      pluginId,
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });
    const host = await startForge({
      logger: silentLogger(),
      pluginsDir: directory,
      persist,
    });
    expect(host.manager.getActive(pluginId)).toBeDefined();
    const provider = await getForgeHost().services.resolve(instance.id);
    expect(provider.pluginId).toBe(pluginId);
    expect(provider.instance.id).toBe(instance.id);
    expect(provider.supports("provision.create")).toBe(true);
  });

  it("exposes a working gateway registry and mounted webhook route after boot", async () => {
    const directory = await tempDir();
    const pluginId = "acme.pay";
    const pluginManifest = manifest(pluginId, {
      type: "gateway",
      permissions: ["billing.checkout", "billing.webhook", "webhooks.receive"],
    });
    await writePlugin(
      directory,
      pluginId,
      `export default {
  manifest: ${JSON.stringify(pluginManifest)},
  webhookHandlers() { return ["notify"]; },
  async createCheckout() {
    return { mode: "offline", checkoutId: "chk_1", status: "pending" };
  },
  async getPaymentStatus() { return "pending"; },
  async handleWebhook() { return { status: 200, recognized: true, body: { ok: true } }; },
};
`,
      {
        type: "gateway",
        permissions: ["billing.checkout", "billing.webhook", "webhooks.receive"],
      },
    );
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: pluginId,
      type: "gateway",
      version: "1.0.0",
      manifest: pluginManifest,
      enabled: true,
    });
    const instance = await persist.createInstance({
      pluginId,
      kind: "gateway",
      displayName: "Primary",
      enabled: true,
    });
    const host = await startForge({
      logger: silentLogger(),
      pluginsDir: directory,
      persist,
    });
    expect(host.manager.getActive(pluginId)).toBeDefined();
    const provider = await getForgeHost().gateways.resolve(instance.id);
    expect(provider.pluginId).toBe(pluginId);
    expect(provider.instance.id).toBe(instance.id);

    const app = createApp({
      logger: silentLogger(),
      redis: { ping: async () => "PONG" },
      postgres: { ping: async () => undefined },
      auth: createMemoryAuth(),
      forge: host,
    });
    const path = forgeWebhookPath(pluginId, instance.id, "notify");
    const hit = await app.request(path, { method: "POST", body: "{}" });
    expect(hit.status).toBe(200);
    expect(await hit.json()).toEqual({ ok: true });

    const missing = await app.request(
      forgeWebhookPath("missing.pay", instance.id, "notify"),
      { method: "POST", body: "{}" },
    );
    expect(missing.status).toBe(404);
  });

  it("skips disk plugins when persist and database are missing", async () => {
    const directory = await tempDir();
    await writePlugin(
      directory,
      "acme.ok",
      `export default { manifest: ${JSON.stringify(manifest("acme.ok"))} };\n`,
    );
    const host = await startForge({
      logger: silentLogger(),
      pluginsDir: directory,
    });
    expect(host.manager.list()).toEqual([]);
    expect(await host.services.listInstances()).toEqual([]);
    expect(await host.gateways.listInstances()).toEqual([]);
  });
});

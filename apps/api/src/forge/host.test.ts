import { describe, expect, it } from "vitest";
import { createInstallStateAdapter, installStateFromRow } from "./host.js";
import { createMemoryPluginPersist } from "./persist.js";

const manifest = {
  id: "acme.demo",
  name: "Demo",
  version: "1.2.3",
  type: "service" as const,
  forgeApi: "^0.1.0",
  entry: "index.js",
};

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

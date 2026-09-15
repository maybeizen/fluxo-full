import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { themeCatalog } from "@/theme-system/catalog";
import { loadPanelPluginCatalog, panelPluginCatalog, parsePanelPluginCatalogId } from "./catalog";
import { panelExtensionRegistry, registerPanelContribution, resetPanelExtensionRegistry } from "./registry";

afterEach(() => {
  resetPanelExtensionRegistry();
});

describe("panel plugin catalog", () => {
  it("is a separate allowlist from the theme catalog", () => {
    expect(Object.keys(themeCatalog).sort()).toEqual(["default", "example"]);
    expect(themeCatalog).not.toHaveProperty("plugin");
    expect(Object.keys(panelPluginCatalog)).toEqual([]);
    expect(panelPluginCatalog).not.toBe(themeCatalog);
    expect(parsePanelPluginCatalogId("default", themeCatalog)).toBe("default");
    expect(parsePanelPluginCatalogId("default")).toBeUndefined();
    expect(parsePanelPluginCatalogId("acme.status")).toBeUndefined();
    expect(parsePanelPluginCatalogId("__proto__")).toBeUndefined();
  });

  it("does not live in the theme-system module", () => {
    const catalogSource = readFileSync(resolve(import.meta.dirname, "../theme-system/catalog.ts"), "utf8");
    const indexSource = readFileSync(resolve(import.meta.dirname, "../theme-system/index.ts"), "utf8");
    expect(catalogSource).not.toMatch(/plugin-system/);
    expect(catalogSource).not.toMatch(/panelPluginCatalog/);
    expect(indexSource).not.toMatch(/plugin-system/);
  });

  it("loads only statically registered catalog entries", async () => {
    const catalog = {
      "acme.status": async () => ({
        register: (api: { register: typeof registerPanelContribution }) => {
          api.register({
            pluginId: "acme.status",
            point: "admin.dashboard.widget",
            contributionId: "uptime",
            component: () => null,
          });
        },
      }),
    };

    await loadPanelPluginCatalog(catalog);
    expect(parsePanelPluginCatalogId("acme.status", catalog)).toBe("acme.status");
    expect(parsePanelPluginCatalogId("other.plugin", catalog)).toBeUndefined();
    expect(panelExtensionRegistry.list("admin.dashboard.widget")).toHaveLength(1);
  });
});

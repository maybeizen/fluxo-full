import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { themeCatalog } from "@/theme-system/catalog";
import {
  loadPanelPluginCatalog,
  panelPluginCatalog,
  parsePanelPluginCatalogId,
} from "./catalog";
import {
  ensurePanelPluginCatalog,
  panelExtensionRegistry,
  registerPanelContribution,
  resetPanelExtensionRegistry,
} from "./registry";

afterEach(() => {
  resetPanelExtensionRegistry();
});

describe("panel plugin catalog", () => {
  it("is a separate allowlist from the theme catalog", () => {
    expect(Object.keys(themeCatalog).sort()).toEqual(["default", "example"]);
    expect(themeCatalog).not.toHaveProperty("plugin");
    expect(Object.keys(panelPluginCatalog)).toEqual(["example-panel"]);
    expect(panelPluginCatalog).not.toBe(themeCatalog);
    expect(parsePanelPluginCatalogId("default", themeCatalog)).toBe("default");
    expect(parsePanelPluginCatalogId("default")).toBeUndefined();
    expect(parsePanelPluginCatalogId("example-panel")).toBe("example-panel");
    expect(parsePanelPluginCatalogId("acme.status")).toBeUndefined();
    expect(parsePanelPluginCatalogId("__proto__")).toBeUndefined();
  });

  it("does not live in the theme-system module", () => {
    const catalogSource = readFileSync(
      resolve(import.meta.dirname, "../theme-system/catalog.ts"),
      "utf8",
    );
    const indexSource = readFileSync(
      resolve(import.meta.dirname, "../theme-system/index.ts"),
      "utf8",
    );
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
    expect(parsePanelPluginCatalogId("acme.status", catalog)).toBe(
      "acme.status",
    );
    expect(parsePanelPluginCatalogId("other.plugin", catalog)).toBeUndefined();
    expect(panelExtensionRegistry.list("admin.dashboard.widget")).toHaveLength(
      1,
    );
  });

  it("registers the example panel widget for admin.dashboard.widget", async () => {
    const catalogSource = readFileSync(
      resolve(import.meta.dirname, "catalog.ts"),
      "utf8",
    );
    expect(catalogSource).toMatch(
      /"example-panel":\s*\(\)\s*=>\s*import\("\.\/plugins\/example-panel"\)/,
    );
    expect(catalogSource).not.toMatch(/import\(\s*[a-zA-Z_][\w.]*\s*\)/);

    await loadPanelPluginCatalog();
    const widgets = panelExtensionRegistry.list("admin.dashboard.widget");
    expect(widgets).toEqual([
      expect.objectContaining({
        pluginId: "example-panel",
        point: "admin.dashboard.widget",
        contributionId: "status",
        title: "Example",
      }),
    ]);
  });

  it("reloads the catalog after a registry reset", async () => {
    await ensurePanelPluginCatalog();
    expect(panelExtensionRegistry.list("admin.dashboard.widget")).toHaveLength(
      1,
    );
    resetPanelExtensionRegistry();
    expect(panelExtensionRegistry.list("admin.dashboard.widget")).toHaveLength(
      0,
    );
    await ensurePanelPluginCatalog();
    expect(panelExtensionRegistry.list("admin.dashboard.widget")).toHaveLength(
      1,
    );
  });

  it("is bootstrapped from app providers, not the theme system", () => {
    const providersSource = readFileSync(
      resolve(import.meta.dirname, "../app/providers.tsx"),
      "utf8",
    );
    const themeProviderSource = readFileSync(
      resolve(import.meta.dirname, "../theme-system/provider.tsx"),
      "utf8",
    );
    expect(providersSource).toContain("PluginSystemProvider");
    expect(themeProviderSource).not.toMatch(/plugin-system/);
  });
});

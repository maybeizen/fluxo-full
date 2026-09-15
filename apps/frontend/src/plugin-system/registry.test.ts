import { describe, expect, it } from "vitest";
import { createPanelExtensionRegistry, isPanelExtensionPoint } from "./registry";

function Widget() {
  return null;
}

describe("panel extension registry", () => {
  it("registers and lists contributions by point", () => {
    const registry = createPanelExtensionRegistry();
    registry.register({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      title: "Uptime",
      order: 20,
      component: Widget,
    });
    registry.register({
      pluginId: "acme.status",
      point: "client.settings.section",
      contributionId: "tokens",
      component: Widget,
    });

    const widgets = registry.list("admin.dashboard.widget");
    expect(widgets).toHaveLength(1);
    expect(widgets[0]?.contributionId).toBe("uptime");
    expect(registry.list("client.settings.section")).toHaveLength(1);
    expect(registry.list()).toHaveLength(2);
  });

  it("ignores unknown points, invalid ids, and invalid contribution ids", () => {
    const registry = createPanelExtensionRegistry();
    registry.register({
      pluginId: "acme.status",
      point: "store.cart.widget" as "admin.dashboard.widget",
      contributionId: "cart",
      component: Widget,
    });
    registry.register({
      pluginId: "Not Valid",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      component: Widget,
    });
    registry.register({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "Bad-Id",
      component: Widget,
    });
    registry.register({
      pluginId: "../escape",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      component: Widget,
    });

    expect(registry.list()).toEqual([]);
    expect(registry.list("admin.dashboard.widget")).toEqual([]);
    expect(isPanelExtensionPoint("store.cart.widget")).toBe(false);
    expect(isPanelExtensionPoint("admin.dashboard.widget")).toBe(true);
  });

  it("omits disabled plugin contributions from listEnabled", () => {
    const registry = createPanelExtensionRegistry();
    registry.register({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      component: Widget,
    });
    registry.register({
      pluginId: "other.news",
      point: "admin.dashboard.widget",
      contributionId: "headlines",
      component: Widget,
    });

    expect(registry.listEnabled("admin.dashboard.widget")).toHaveLength(2);
    registry.setEnabledPluginIds(["acme.status"]);
    const enabled = registry.listEnabled("admin.dashboard.widget");
    expect(enabled).toHaveLength(1);
    expect(enabled[0]?.pluginId).toBe("acme.status");
    expect(registry.list("admin.dashboard.widget")).toHaveLength(2);
  });

  it("orders by order, then plugin id, then contribution id", () => {
    const registry = createPanelExtensionRegistry();
    registry.register({
      pluginId: "zeta.plugin",
      point: "admin.dashboard.widget",
      contributionId: "b",
      order: 1,
      component: Widget,
    });
    registry.register({
      pluginId: "alpha.plugin",
      point: "admin.dashboard.widget",
      contributionId: "z",
      order: 1,
      component: Widget,
    });
    registry.register({
      pluginId: "alpha.plugin",
      point: "admin.dashboard.widget",
      contributionId: "a",
      order: 1,
      component: Widget,
    });
    registry.register({
      pluginId: "mid.plugin",
      point: "admin.dashboard.widget",
      contributionId: "first",
      order: 0,
      component: Widget,
    });

    expect(registry.list("admin.dashboard.widget").map((entry) => `${entry.pluginId}:${entry.contributionId}`)).toEqual([
      "mid.plugin:first",
      "alpha.plugin:a",
      "alpha.plugin:z",
      "zeta.plugin:b",
    ]);
  });

  it("replaces a contribution with the same plugin, point, and id", () => {
    const registry = createPanelExtensionRegistry();
    registry.register({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      title: "Old",
      component: Widget,
    });
    registry.register({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      title: "New",
      component: Widget,
    });

    expect(registry.list("admin.dashboard.widget")).toHaveLength(1);
    expect(registry.list("admin.dashboard.widget")[0]?.title).toBe("New");
  });
});

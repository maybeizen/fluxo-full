import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@fluxo/types";
import { PluginSlot } from "./plugin-slot";
import {
  registerPanelContribution,
  resetPanelExtensionRegistry,
  setEnabledPluginIds,
} from "./registry";
import type { PanelContributionPropsMap } from "./types";

afterEach(() => {
  cleanup();
  resetPanelExtensionRegistry();
  vi.restoreAllMocks();
});

const settings = {
  appName: "Fluxo",
  appBaseUrl: "https://fluxo.test",
  billingCurrency: "USD",
  billingLocale: "en-US",
  billingTimezone: "UTC",
};

const user = {
  id: "user-1",
  username: "maya",
  email: "maya@fluxo.test",
  role: UserRole.Admin,
  suspended: false,
};

function OkWidget({
  contributionId,
}: PanelContributionPropsMap["admin.dashboard.widget"]) {
  return <p>{contributionId} ok</p>;
}

function BoomWidget(): never {
  throw new Error("widget crashed");
}

describe("PluginSlot", () => {
  it("keeps other contributions when one throws", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    registerPanelContribution({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "boom",
      order: 0,
      component: BoomWidget,
    });
    registerPanelContribution({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      order: 1,
      component: OkWidget,
    });

    render(
      <PluginSlot
        point="admin.dashboard.widget"
        slotProps={{ user, settings }}
      />,
    );

    expect(screen.getByText("uptime ok")).toBeInTheDocument();
    expect(screen.queryByText("boom ok")).not.toBeInTheDocument();
  });

  it("omits contributions from disabled plugins", () => {
    registerPanelContribution({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      component: OkWidget,
    });
    registerPanelContribution({
      pluginId: "other.news",
      point: "admin.dashboard.widget",
      contributionId: "headlines",
      component: OkWidget,
    });
    setEnabledPluginIds(["acme.status"]);

    render(
      <PluginSlot
        point="admin.dashboard.widget"
        slotProps={{ user, settings }}
      />,
    );

    expect(screen.getByText("uptime ok")).toBeInTheDocument();
    expect(screen.queryByText("headlines ok")).not.toBeInTheDocument();
  });

  it("retries a contribution after the component identity changes", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    registerPanelContribution({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      component: BoomWidget,
    });

    const { rerender } = render(
      <PluginSlot
        point="admin.dashboard.widget"
        slotProps={{ user, settings }}
      />,
    );
    expect(screen.queryByText("uptime ok")).not.toBeInTheDocument();

    registerPanelContribution({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      component: OkWidget,
    });
    rerender(
      <PluginSlot
        point="admin.dashboard.widget"
        slotProps={{ user, settings }}
      />,
    );
    expect(screen.getByText("uptime ok")).toBeInTheDocument();
  });
});

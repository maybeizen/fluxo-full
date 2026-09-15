import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { UserRole } from "@/lib/auth";
import {
  getEnabledPluginIds,
  registerPanelContribution,
} from "@/plugin-system";
import { PluginSlot } from "@/plugin-system/plugin-slot";
import { jsonResponse, mockApiUrl } from "@/test/auth";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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
  role: UserRole.User,
  suspended: false,
};

function OkWidget({
  contributionId,
}: {
  contributionId: string;
}) {
  return <p>{contributionId} ok</p>;
}

describe("PluginSystemProvider", () => {
  it("applies enabled panel plugin ids from the public list", async () => {
    mockApiUrl();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/auth/me")) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        if (url.endsWith("/plugins/panel")) {
          return jsonResponse({ pluginIds: ["acme.status"] });
        }
        return jsonResponse({ error: "Not found" }, 404);
      }),
    );
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

    render(
      <AppProviders>
        <PluginSlot
          point="admin.dashboard.widget"
          slotProps={{ user, settings }}
        />
      </AppProviders>,
    );

    expect(screen.getByText("uptime ok")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("headlines ok")).not.toBeInTheDocument();
    });
    expect(screen.getByText("uptime ok")).toBeInTheDocument();
    expect([... (getEnabledPluginIds() ?? [])]).toEqual(["acme.status"]);
  });
});

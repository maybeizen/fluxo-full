import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UserRole } from "@fluxo/types";
import { loadPanelPluginCatalog } from "../catalog";
import { PluginSlot } from "../plugin-slot";
import { resetPanelExtensionRegistry } from "../registry";

afterEach(() => {
  cleanup();
  resetPanelExtensionRegistry();
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

describe("example-panel frontend contribution", () => {
  it("renders the admin dashboard widget from typed contribution props", async () => {
    await loadPanelPluginCatalog();
    render(
      <PluginSlot
        point="admin.dashboard.widget"
        slotProps={{ user, settings }}
      />,
    );
    expect(screen.getByTestId("example-panel-status")).toHaveTextContent(
      "Fluxo",
    );
  });
});

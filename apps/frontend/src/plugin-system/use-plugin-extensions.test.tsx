import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  registerPanelContribution,
  resetPanelExtensionRegistry,
  setEnabledPluginIds,
} from "./registry";
import { usePluginExtensions } from "./use-plugin-extensions";

afterEach(() => {
  cleanup();
  resetPanelExtensionRegistry();
});

function Widget() {
  return null;
}

function Probe({
  enabledPluginIds,
}: {
  enabledPluginIds?: readonly string[] | null;
}) {
  const items = usePluginExtensions("admin.dashboard.widget", {
    enabledPluginIds,
  });
  return (
    <ul>
      {items.map((item) => (
        <li key={`${item.pluginId}:${item.contributionId}`}>
          {item.contributionId}
        </li>
      ))}
    </ul>
  );
}

describe("usePluginExtensions", () => {
  it("returns registered contributions and omits disabled plugins", () => {
    registerPanelContribution({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      component: Widget,
    });
    registerPanelContribution({
      pluginId: "other.news",
      point: "admin.dashboard.widget",
      contributionId: "headlines",
      component: Widget,
    });

    const { rerender } = render(<Probe />);
    expect(screen.getByText("uptime")).toBeInTheDocument();
    expect(screen.getByText("headlines")).toBeInTheDocument();

    act(() => {
      setEnabledPluginIds(["acme.status"]);
    });
    rerender(<Probe />);
    expect(screen.getByText("uptime")).toBeInTheDocument();
    expect(screen.queryByText("headlines")).not.toBeInTheDocument();
  });

  it("returns a stable list when the registry has not changed", () => {
    registerPanelContribution({
      pluginId: "acme.status",
      point: "admin.dashboard.widget",
      contributionId: "uptime",
      component: Widget,
    });

    const seen: unknown[] = [];
    function StableProbe({ tick }: { tick: number }) {
      const items = usePluginExtensions("admin.dashboard.widget");
      seen.push(items);
      return <span>{tick}</span>;
    }

    const { rerender } = render(<StableProbe tick={1} />);
    rerender(<StableProbe tick={2} />);
    expect(seen[0]).toBe(seen[1]);
  });
});

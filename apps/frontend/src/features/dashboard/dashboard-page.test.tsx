import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { defaultComponents } from "@/registry/defaults";
import type { UIComponents, UIOverrides } from "@/registry/types";
import { routeTree } from "@/routeTree.gen";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";
import { formatJoined } from "./format";

function mockDashboardApis() {
  const user = createUser({
    firstName: "Maya",
    lastName: "Izen",
    username: "maya",
    createdAt: "2026-01-15T12:00:00.000Z",
  });
  mockApiUrl();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/me")) {
        return jsonResponse({ user });
      }
      return jsonResponse({ error: "Not found" }, 404);
    }),
  );
  return user;
}

async function renderDashboard(components?: UIOverrides) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/dashboard"],
    }),
  });
  await router.load();
  return render(
    <AppProviders components={components}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Dashboard page", () => {
  it("renders profile fields from the session", async () => {
    const user = mockDashboardApis();
    await renderDashboard();

    expect(await screen.findByText("Maya Izen")).toBeInTheDocument();
    expect(screen.getByText(`@${user.username}`)).toBeInTheDocument();
    expect(
      screen.getByText(`Joined ${formatJoined(user.createdAt)}`),
    ).toBeInTheDocument();
    expect(screen.getByText("Edit profile").closest("a")).toHaveAttribute("href", "/settings");
    const links = screen.getByRole("list", { name: /^links$/i });
    expect(within(links).getByRole("button", { name: "Documentation" }).closest("a")).toHaveAttribute(
      "href",
      "/#docs",
    );
    expect(within(links).getByRole("button", { name: "Discord" }).closest("a")).toHaveAttribute(
      "href",
      "https://discord.com",
    );
    expect(within(links).getByRole("button", { name: "Support" }).closest("a")).toHaveAttribute(
      "href",
      "/support",
    );
  });

  it("switches tabs and shows empty states", async () => {
    mockDashboardApis();
    await renderDashboard();

    expect(await screen.findByRole("tab", { name: /active services/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /invoices/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /news/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^support$/i })).toBeInTheDocument();
    expect(screen.getByText("No active services")).toBeVisible();
    expect(screen.getByText("You have not provisioned a server yet.")).toBeVisible();
    expect(screen.getByRole("button", { name: /get a server now!/i }).closest("a")).toHaveAttribute(
      "href",
      "/store",
    );

    fireEvent.click(screen.getByRole("tab", { name: /invoices/i }));
    expect(await screen.findByText("No invoices")).toBeVisible();
    expect(screen.getByText("Usage invoices will appear here when a cycle closes.")).toBeVisible();
    expect(screen.queryByText("No active services")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /news/i }));
    expect(await screen.findByText("No news yet")).toBeVisible();
    expect(screen.queryByText("No invoices")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /^support$/i }));
    expect(await screen.findByText("Need a hand?")).toBeVisible();
  });

  it("composes the default theme through useUI", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./dashboard-page.tsx"), "utf8");
    expect(source).toContain("useUI");
    expect(source).toContain("DashboardPage: View");
    expect(source).not.toMatch(/@\/themes\//);
    expect(defaultComponents.DashboardPage).toBeTypeOf("function");
    expect(defaultComponents.DashboardProfileCard).toBeTypeOf("function");
    expect(defaultComponents.DashboardLinksCard).toBeTypeOf("function");
    expect(defaultComponents.DashboardCta).toBeTypeOf("function");
    expect(defaultComponents.DashboardEmptyState).toBeTypeOf("function");
    expect(defaultComponents.DashboardServicesPanel).toBeTypeOf("function");
    expect(defaultComponents.DashboardInvoicesPanel).toBeTypeOf("function");
    expect(defaultComponents.DashboardNewsPanel).toBeTypeOf("function");
    expect(defaultComponents.DashboardSupportPanel).toBeTypeOf("function");
  });

  it("lets a theme override a dashboard composite", async () => {
    mockDashboardApis();
    const OverrideCta: UIComponents["DashboardCta"] = () => (
      <div data-testid="override-cta">Custom dashboard CTA</div>
    );

    await renderDashboard({ DashboardCta: OverrideCta });

    expect(await screen.findByTestId("override-cta")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /browse the store/i })).not.toBeInTheDocument();
    expect(screen.getByText("Maya Izen")).toBeInTheDocument();
  });
});

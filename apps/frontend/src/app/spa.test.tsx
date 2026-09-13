import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";
import { UIProvider, useUI } from "@/registry/ui-provider";
import type { UIComponents } from "@/registry/types";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";

async function renderShell(initialEntry = "/") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [initialEntry],
    }),
  });
  await router.load();
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

function RegistryProbe() {
  const { Button } = useUI();
  return <Button>Override me</Button>;
}

function mockAuthenticatedSession() {
  mockApiUrl();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/me")) {
        return jsonResponse({ user: createUser() });
      }
      if (url.endsWith("/health")) {
        return jsonResponse({
          status: "ok",
          service: "api",
          checks: {},
          timestamp: new Date().toISOString(),
        });
      }
      return jsonResponse({ error: "Not found" }, 404);
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Fluxo SPA shell", () => {
  it("renders the marketing landing", async () => {
    document.documentElement.classList.add("dark");
    await renderShell("/");

    expect(screen.getAllByRole("link", { name: "Fluxo" }).length).toBeGreaterThan(0);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).getByRole("link", { name: "Features" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Plans" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Docs" })).toBeInTheDocument();
    expect((await screen.findAllByRole("button", { name: "Login" })).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Get started" }).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "The billing panel for game-server hosts.",
      }),
    ).toBeInTheDocument();
  });

  it("applies dark pastel-red theme tokens", () => {
    document.documentElement.classList.add("dark");
    const tokensCss = readFileSync(
      resolve(import.meta.dirname, "../themes/default/styles/tokens.css"),
      "utf8",
    );

    expect(tokensCss).toContain("--background: oklch(0.145 0 0)");
    expect(tokensCss).toContain("--primary: oklch(66.855% 0.21868 23.462)");
    expect(tokensCss).toContain("--border: oklch(0.269 0 0)");
    expect(tokensCss).toContain("--muted: oklch(0.205 0 0)");
    expect(tokensCss).toContain("--ring: oklch(0.68 0.1 18)");
    expect(tokensCss).toContain("--accent: oklch(0.28 0.06 18)");
    expect(tokensCss).toContain("--destructive: oklch(0.63 0.18 25)");
    expect(tokensCss).toContain("color-scheme: dark");
    expect(tokensCss).toMatch(/:root\s*,\s*\.dark/);
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("replaces Button through the UI registry", () => {
    const OverrideButton: UIComponents["Button"] = (
      props: ComponentProps<UIComponents["Button"]>,
    ) => <button data-testid="override-button" type="button">{props.children}</button>;

    render(
      <UIProvider components={{ Button: OverrideButton }}>
        <RegistryProbe />
      </UIProvider>,
    );

    expect(screen.getByTestId("override-button")).toHaveTextContent("Override me");
  });

  it("renders product sidebar links and breadcrumbs", async () => {
    mockAuthenticatedSession();
    await renderShell("/dashboard");

    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Services" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Invoices" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Store" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cart" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Support" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "News" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Servers" })).not.toBeInTheDocument();

    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(crumbs).getByRole("link", { name: "Fluxo" })).toBeInTheDocument();
    expect(crumbs).toHaveTextContent("Dashboard");
  });
});

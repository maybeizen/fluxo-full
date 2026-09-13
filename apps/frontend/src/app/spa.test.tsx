import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";
import { UIProvider, useUI } from "@/registry/ui-provider";
import type { UIComponents } from "@/registry/types";

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

describe("Fluxo SPA shell", () => {
  it("renders the dark working shell", async () => {
    document.documentElement.classList.add("dark");
    await renderShell("/");

    expect(screen.getByText("Fluxo")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Working shell for the Fluxo control plane.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
  });

  it("applies dark pastel-red theme tokens", () => {
    document.documentElement.classList.add("dark");
    const tokensCss = readFileSync(
      resolve(import.meta.dirname, "../theme/tokens.css"),
      "utf8",
    );

    expect(tokensCss).toContain("--primary: oklch(0.58 0.12 18)");
    expect(tokensCss).toContain("--ring: oklch(0.58 0.08 18)");
    expect(tokensCss).toContain("--accent: oklch(0.3 0.04 18)");
    expect(tokensCss).toContain("--background: oklch(0.16 0.008 18)");
    expect(tokensCss).toContain("--destructive: oklch(0.63 0.18 25)");
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
});

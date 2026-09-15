import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";
import { UserRole } from "@/lib/auth";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";
import type { AdminPluginListItem } from "./types";

function createPlugin(overrides: Partial<AdminPluginListItem> = {}): AdminPluginListItem {
  return {
    id: "acme.mail",
    type: "service",
    name: "Mail",
    version: "1.0.0",
    description: "Outbound mail",
    author: "Acme",
    forgeApi: "^0.1.0",
    permissions: ["config.read"],
    status: "enabled",
    instanceCount: 0,
    enabled: true,
    installed: true,
    discovered: true,
    compatibility: { ok: true, forgeApi: "^0.1.0", hostVersion: "0.1.0" },
    ...overrides,
  };
}

function mockAdminApis(plugins: AdminPluginListItem[]) {
  const admin = createUser({
    id: "user-1",
    username: "maya",
    role: UserRole.Admin,
  });
  mockApiUrl();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/auth/me")) {
        return jsonResponse({ user: admin });
      }
      if (url.endsWith("/admin/plugins")) {
        return jsonResponse({ plugins });
      }
      return jsonResponse({ error: "Not found" }, 404);
    }),
  );
}

async function renderPlugins() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/admin/plugins"],
    }),
  });
  await router.load();
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Admin plugins page", () => {
  it("renders the trust notice and plugin table headers", async () => {
    mockAdminApis([createPlugin()]);
    await renderPlugins();

    expect(
      await screen.findByText(
        "Installing a plugin trusts its code the same way you trust an npm dependency of the API.",
      ),
    ).toBeInTheDocument();

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Plugin ID" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Version" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Enabled" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Compatibility" })).toBeInTheDocument();
    expect(within(table).getByText("Mail")).toBeInTheDocument();
    expect(within(table).getByText("acme.mail")).toBeInTheDocument();
  });
});

import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";
import { UserRole, type PublicUser } from "@/lib/auth";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";

async function renderLanding() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/"],
    }),
  });
  await router.load();
  return render(
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>,
  );
}

function mockSession(user: PublicUser) {
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
}

async function openAccountMenu(): Promise<void> {
  const triggers = await screen.findAllByRole("button", { name: /account menu/i });
  const trigger = triggers[0];
  if (!trigger) {
    throw new Error("Account menu trigger not found");
  }
  fireEvent.click(trigger);
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("AvatarDropdown", () => {
  it("replaces navbar Login and Get started when a session exists", async () => {
    mockSession(createUser());
    await renderLanding();

    expect((await screen.findAllByRole("button", { name: /account menu/i })).length).toBeGreaterThan(0);
    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(within(nav).queryByRole("button", { name: "Login" })).not.toBeInTheDocument();
    expect(within(nav).queryByRole("button", { name: "Get started" })).not.toBeInTheDocument();
  });

  it("shows Admin only for admin users", async () => {
    mockSession(createUser({ role: UserRole.Admin, username: "root" }));
    await renderLanding();

    await openAccountMenu();
    expect(await screen.findByText("Admin")).toBeInTheDocument();
  });

  it("shows Leave Admin in the dropdown when on /admin", async () => {
    mockSession(createUser({ role: UserRole.Admin, username: "root" }));
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ["/admin"],
      }),
    });
    await router.load();
    render(
      <AppProviders>
        <RouterProvider router={router} />
      </AppProviders>,
    );

    await openAccountMenu();
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Leave Admin")).toBeInTheDocument();
    expect(within(menu).queryByText("Admin")).not.toBeInTheDocument();
    expect(within(menu).getByText("Dashboard")).toBeInTheDocument();
    expect(within(menu).getByText("Servers")).toBeInTheDocument();
    expect(within(menu).getByText("Settings")).toBeInTheDocument();
    expect(within(menu).getByText("Sign out")).toBeInTheDocument();
  });

  it("hides Admin for non-admin users", async () => {
    mockSession(createUser({ role: UserRole.User }));
    await renderLanding();

    await openAccountMenu();
    expect(await screen.findByText("Maya Izen")).toBeInTheDocument();
    expect(screen.getByText("maya@fluxo.test")).toBeInTheDocument();
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Servers")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
  });
});

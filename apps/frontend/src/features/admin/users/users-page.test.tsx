import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";
import { UserRole } from "@/lib/auth";
import { registerPanelContribution } from "@/plugin-system";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";
import type { AdminUserListItem } from "../types";

function createListItem(
  overrides: Partial<AdminUserListItem> = {},
): AdminUserListItem {
  return {
    id: "user-1",
    username: "maya",
    email: "maya@fluxo.test",
    avatarUrl: null,
    role: UserRole.Admin,
    emailVerified: true,
    mfaEnabled: false,
    hasPasskey: false,
    createdAt: "2026-01-15T12:00:00.000Z",
    suspended: false,
    ...overrides,
  };
}

function mockAdminApis(users: AdminUserListItem[]) {
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
      if (url.endsWith("/admin/users")) {
        return jsonResponse({ users });
      }
      return jsonResponse({ error: "Not found" }, 404);
    }),
  );
}

async function renderUsers() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/admin/users"],
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

describe("Admin users page", () => {
  it("renders users table headers", async () => {
    mockAdminApis([
      createListItem(),
      createListItem({
        id: "user-2",
        username: "ada",
        email: "ada@fluxo.test",
        role: UserRole.User,
        emailVerified: false,
      }),
    ]);
    await renderUsers();

    const table = await screen.findByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "User ID" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Username" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Email" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Role" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Sign-in" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Verified" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Joined" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("columnheader", { name: "Actions" }),
    ).toBeInTheDocument();
    expect(within(table).getByLabelText("Verified")).toBeInTheDocument();
    expect(within(table).getByLabelText("Not verified")).toBeInTheDocument();
  });

  it("disables delete for the current user", async () => {
    mockAdminApis([
      createListItem(),
      createListItem({
        id: "user-2",
        username: "ada",
        email: "ada@fluxo.test",
        role: UserRole.User,
      }),
    ]);
    await renderUsers();

    const table = await screen.findByRole("table");
    const currentRow = within(table).getByRole("row", { name: /maya/i });
    const otherRow = within(table).getByRole("row", { name: /ada/i });
    expect(
      within(currentRow).getByRole("button", { name: "Delete" }),
    ).toBeDisabled();
    expect(
      within(otherRow).getByRole("button", { name: "Delete" }),
    ).toBeEnabled();
  });

  it("truncates the user id and copies it on click", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mockAdminApis([
      createListItem({
        id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    ]);
    await renderUsers();

    const table = await screen.findByRole("table");
    const copyButton = within(table).getByRole("button", {
      name: "Copy user ID 550e8400-e29b-41d4-a716-446655440000",
    });
    expect(copyButton).toHaveTextContent("550e8400…");
    expect(within(table).getByText("maya")).toBeInTheDocument();
    expect(within(table).getByText("MA")).toBeInTheDocument();
    copyButton.click();
    expect(writeText).toHaveBeenCalledWith(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("renders panel plugin list actions for each user", async () => {
    mockAdminApis([
      createListItem(),
      createListItem({
        id: "user-2",
        username: "ada",
        email: "ada@fluxo.test",
        role: UserRole.User,
      }),
    ]);
    registerPanelContribution({
      pluginId: "acme.status",
      point: "admin.users.listAction",
      contributionId: "impersonate",
      component: ({ targetUser }) => (
        <button type="button">Inspect {targetUser.username}</button>
      ),
    });

    await renderUsers();

    const table = await screen.findByRole("table");
    expect(
      within(table).getByRole("button", { name: "Inspect maya" }),
    ).toBeInTheDocument();
    expect(
      within(table).getByRole("button", { name: "Inspect ada" }),
    ).toBeInTheDocument();
  });
});

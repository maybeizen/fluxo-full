import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";
import { UserRole } from "@/lib/auth";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";
import type { AdminUserDetail } from "../types";

function createDetail(overrides: Partial<AdminUserDetail> = {}): AdminUserDetail {
  return {
    id: "user-1",
    username: "maya",
    email: "maya@fluxo.test",
    firstName: "Maya",
    lastName: "Izen",
    avatarUrl: null,
    avatarSource: "none",
    dateOfBirth: null,
    company: null,
    role: UserRole.Admin,
    emailVerified: true,
    mfaEnabled: false,
    hasPasskey: false,
    passkeys: [],
    createdAt: "2026-01-15T12:00:00.000Z",
    lastActiveAt: "2026-01-16T08:00:00.000Z",
    suspended: false,
    suspendedAt: null,
    suspendedReason: null,
    ...overrides,
  };
}

function mockAdminApis(detail: AdminUserDetail) {
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
      if (url.endsWith(`/admin/users/${detail.id}`)) {
        return jsonResponse(detail);
      }
      return jsonResponse({ error: "Not found" }, 404);
    }),
  );
}

async function renderEdit(userId: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [`/admin/users/${userId}`],
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

describe("Admin user edit page", () => {
  it("locks role and suspend on the current account", async () => {
    mockAdminApis(createDetail());
    await renderEdit("user-1");

    expect(await screen.findByText("Maya Izen")).toBeInTheDocument();
    expect(screen.getByText("@maya")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy user ID user-1" })).toHaveTextContent(
      "user-1",
    );
    expect(await screen.findByLabelText("Role")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Suspended" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByText("You cannot remove your own admin role.")).toBeInTheDocument();
    expect(screen.getByText("You cannot suspend your own account.")).toBeInTheDocument();
    expect(screen.getByText("Sign-in methods")).toBeInTheDocument();
    expect(screen.getAllByText("Password").length).toBeGreaterThan(0);
    expect(screen.queryByText("Authenticator app")).not.toBeInTheDocument();
  });

  it("lists authenticator and named passkeys without secrets", async () => {
    mockAdminApis(
      createDetail({
        mfaEnabled: true,
        hasPasskey: true,
        passkeys: [{ name: "Laptop" }],
      }),
    );
    await renderEdit("user-1");

    expect(await screen.findByText("Sign-in methods")).toBeInTheDocument();
    expect(screen.getAllByText("Password").length).toBeGreaterThan(0);
    expect(screen.getByText("Authenticator app")).toBeInTheDocument();
    expect(screen.getByText("Passkey")).toBeInTheDocument();
    expect(screen.getByText("Laptop")).toBeInTheDocument();
  });

  it("shows the full user id on the overview card", async () => {
    mockAdminApis(
      createDetail({
        id: "550e8400-e29b-41d4-a716-446655440000",
      }),
    );
    await renderEdit("550e8400-e29b-41d4-a716-446655440000");

    const copyButton = await screen.findByRole("button", {
      name: "Copy user ID 550e8400-e29b-41d4-a716-446655440000",
    });
    expect(copyButton).toHaveTextContent("550e8400-e29b-41d4-a716-446655440000");
    expect(copyButton).not.toHaveTextContent("550e8400…");
  });

  it("allows role and suspend changes on another account", async () => {
    mockAdminApis(
      createDetail({
        id: "user-2",
        username: "ada",
        email: "ada@fluxo.test",
        role: UserRole.User,
      }),
    );
    await renderEdit("user-2");

    expect(await screen.findByLabelText("Role")).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: "Suspended" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.queryByText("You cannot remove your own admin role.")).not.toBeInTheDocument();
    expect(screen.queryByText("You cannot suspend your own account.")).not.toBeInTheDocument();
  });
});

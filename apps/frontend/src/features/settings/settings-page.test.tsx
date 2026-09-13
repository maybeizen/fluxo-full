import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";

const backupCodes = ["alpha-1111", "bravo-2222", "charlie-3333"];

function mockSettingsApis(options?: { mfaEnabled?: boolean }) {
  const user = createUser({
    firstName: "Maya",
    lastName: "Izen",
    dateOfBirth: "1994-04-12",
    company: "Fluxo",
    mfaEnabled: options?.mfaEnabled ?? false,
  });
  mockApiUrl();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) {
      return jsonResponse({ user });
    }
    if (url.endsWith("/auth/mfa/setup") && init?.method === "POST") {
      return jsonResponse({
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl: "otpauth://totp/Fluxo:maya?secret=JBSWY3DPEHPK3PXP",
      });
    }
    if (url.endsWith("/auth/mfa/enable") && init?.method === "POST") {
      return jsonResponse({
        user: { ...user, mfaEnabled: true },
        backupCodes,
        suggestDownload: true,
      });
    }
    if (url.endsWith("/auth/passkeys")) {
      return jsonResponse({ passkeys: [] });
    }
    if (url.endsWith("/auth/sessions")) {
      return jsonResponse({
        sessions: [
          {
            id: "session-current",
            current: true,
            createdAt: "2026-09-01T10:00:00.000Z",
            lastSeenAt: "2026-09-12T18:00:00.000Z",
            userAgent: "Fluxo Browser",
            ip: "203.0.113.10",
          },
          {
            id: "session-other",
            current: false,
            createdAt: "2026-08-20T10:00:00.000Z",
            lastSeenAt: "2026-09-11T12:00:00.000Z",
            userAgent: "Other Device",
            ip: "198.51.100.20",
          },
        ],
      });
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
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderSettings(path = "/settings") {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: [path],
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

describe("Settings page", () => {
  it("renders profile fields", async () => {
    mockSettingsApis();
    await renderSettings();

    expect(await screen.findByLabelText(/^first name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^last name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^company$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Maya")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Izen")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Fluxo")).toBeInTheDocument();
  });

  it("shows MFA backup codes after enable", async () => {
    mockSettingsApis();
    await renderSettings("/settings?tab=security");

    fireEvent.click(await screen.findByRole("button", { name: /set up authenticator/i }));

    expect(await screen.findByDisplayValue("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/authentication code/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enable mfa/i }));

    await waitFor(() => {
      expect(screen.getByText("Backup codes")).toBeInTheDocument();
    });
    expect(screen.getByText("alpha-1111")).toBeInTheDocument();
    expect(screen.getByText("bravo-2222")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download codes/i })).toBeInTheDocument();
  });

  it("shows a session revoke button", async () => {
    mockSettingsApis();
    await renderSettings("/settings?tab=sessions");

    expect(await screen.findByRole("button", { name: /^revoke$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revoke others/i })).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });
});

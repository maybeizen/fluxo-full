import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";

async function renderLogin() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/login"],
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

describe("Login page", () => {
  it("renders username, password, Google, GitHub, and passkey actions", async () => {
    await renderLogin();

    expect(await screen.findByLabelText(/^username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /passkey/i })).toBeInTheDocument();
  });

  it("submits credentials to the login API", async () => {
    const user = createUser();
    mockApiUrl();
    let authenticated = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/auth/login") && init?.method === "POST") {
        authenticated = true;
        return jsonResponse({ user });
      }
      if (url.endsWith("/auth/me")) {
        if (!authenticated) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }
        return jsonResponse({ user });
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

    await renderLogin();

    fireEvent.change(await screen.findByLabelText(/^username$/i), {
      target: { value: "maya" },
    });
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: "secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/auth/login",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            username: "maya",
            password: "secret",
            rememberMe: false,
          }),
        }),
      );
    });
  });
});

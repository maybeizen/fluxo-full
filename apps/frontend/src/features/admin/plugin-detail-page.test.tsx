import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { routeTree } from "@/routeTree.gen";
import { UserRole } from "@/lib/auth";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";
import type { AdminPluginDetail } from "./plugins/types";

const SECRET = "tok_live_must_not_render";

function createDetail(
  overrides: Partial<AdminPluginDetail> = {},
): AdminPluginDetail {
  return {
    id: "acme.mail",
    type: "service",
    name: "Mail",
    version: "1.0.0",
    description: "Outbound mail",
    author: "Acme",
    forgeApi: "^0.1.0",
    permissions: ["config.read", "config.write"],
    status: "enabled",
    instanceCount: 1,
    enabled: true,
    installed: true,
    discovered: true,
    compatibility: { ok: true, forgeApi: "^0.1.0", hostVersion: "0.1.0" },
    ...overrides,
  };
}

function mockAdminApis(detail: AdminPluginDetail) {
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
      if (url.endsWith("/admin/plugins/acme.mail/config")) {
        return jsonResponse({
          schema: [
            { key: "host", type: "text", label: "Host", required: true },
            {
              key: "api_token",
              type: "secret",
              label: "API token",
              required: true,
            },
          ],
          values: { host: "smtp.example.com" },
          secretKeysSet: ["api_token"],
        });
      }
      if (url.endsWith("/admin/plugins/acme.mail/instances")) {
        return jsonResponse({
          instances: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              pluginId: "acme.mail",
              kind: "service",
              displayName: "Primary",
              enabled: true,
              config: {
                values: { host: "smtp.example.com" },
                secretKeysSet: ["api_token"],
              },
            },
          ],
        });
      }
      if (url.endsWith("/admin/plugins/acme.mail")) {
        return jsonResponse(detail);
      }
      return jsonResponse({ error: "Not found" }, 404);
    }),
  );
}

async function renderDetail() {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/admin/plugins/acme.mail"],
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

describe("Admin plugin detail page", () => {
  it("renders metadata and does not show secret values", async () => {
    mockAdminApis(createDetail());
    await renderDetail();

    expect(await screen.findByText("Mail")).toBeInTheDocument();
    expect(screen.getByText("acme.mail")).toBeInTheDocument();
    expect(screen.getByText("config.read")).toBeInTheDocument();
    expect(screen.getByLabelText("API token")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Saved — leave blank to keep"),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue(SECRET)).not.toBeInTheDocument();
    expect(screen.queryByText(SECRET)).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("smtp.example.com")).toBeInTheDocument();
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AppSettingsAdmin, AppSettingsAdminResponse } from "@fluxo/types";
import { FLUXO_THEME_CATALOG } from "@fluxo/types";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProviders } from "@/app/providers";
import { defaultComponents } from "@/registry/defaults";
import type { UIComponents, UIOverrides } from "@/registry/types";
import { routeTree } from "@/routeTree.gen";
import { UserRole } from "@/lib/auth";
import { createUser, jsonResponse, mockApiUrl } from "@/test/auth";

function adminSettings(): AppSettingsAdmin {
  return {
    appName: "Fluxo",
    appBaseUrl: "http://localhost:5173",
    appIconUrl: null,
    activeThemeId: "default",
    authDisableRegistration: false,
    authDisableLogin: false,
    securityCaptchaType: "none",
    securityCaptchaEnabled: false,
    securityCaptchaSiteKey: null,
    appSupportTicketsEnabled: true,
    appMaintenanceModeEnabled: false,
    appMaintenanceMessage: "",
    appGlobalBannerAnnouncementEnabled: false,
    appGlobalBannerAnnouncementMessage: "",
    billingCurrency: "USD",
    billingLocale: "en-US",
    billingTimezone: "UTC",
    authDisableEmailVerificationRequirement: false,
    authDisablePasswordChange: false,
    authDisableMfa: false,
    authStopOutgoingEmails: false,
    emailSmtpHost: null,
    emailSmtpPort: null,
    emailSmtpUser: null,
    emailSmtpPassSet: false,
    emailFromAddress: null,
    storageProvider: "local",
    s3Endpoint: null,
    s3Region: null,
    s3Bucket: null,
    s3AccessKeyIdSet: false,
    s3SecretAccessKeySet: false,
    s3ForcePathStyle: true,
    s3PublicUrlBase: null,
    securityCaptchaSecretKeySet: false,
    appDebugMode: false,
    billingInvoicePrefix: "INV",
    billingInvoiceDueDays: 14,
    billingTaxEnabled: false,
    billingTaxInclusive: false,
    billingTaxRate: 0,
    billingTaxLabel: "Tax",
    billingCompanyName: "",
    billingCompanyAddress: "",
    billingSupportEmail: null,
  };
}

function mockSettingsApis() {
  const admin = createUser({
    id: "user-1",
    username: "maya",
    role: UserRole.Admin,
  });
  mockApiUrl();
  const settings = adminSettings();
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/auth/me")) {
      return jsonResponse({ user: admin });
    }
    if (url.endsWith("/settings/public")) {
      return jsonResponse(settings);
    }
    if (url.endsWith("/admin/settings") && init?.method === "PATCH") {
      const body = JSON.parse(String(init.body)) as { appName?: string };
      return jsonResponse({
        settings: { ...settings, appName: body.appName ?? settings.appName },
        themes: FLUXO_THEME_CATALOG,
      } satisfies AppSettingsAdminResponse);
    }
    if (url.endsWith("/admin/settings")) {
      return jsonResponse({
        settings,
        themes: FLUXO_THEME_CATALOG,
      } satisfies AppSettingsAdminResponse);
    }
    return jsonResponse({ error: "Not found" }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function renderSettings(components?: UIOverrides) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({
      initialEntries: ["/admin/settings"],
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

describe("Admin settings page", () => {
  it("renders settings tabs", async () => {
    mockSettingsApis();
    await renderSettings();

    expect(await screen.findByRole("tab", { name: /application/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /theme/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /authentication/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /smtp/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /storage/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /billing/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/application name/i)).toBeInTheDocument();
  });

  it("saves application settings", async () => {
    const fetchMock = mockSettingsApis();
    await renderSettings();

    const name = await screen.findByLabelText(/application name/i);
    fireEvent.change(name, { target: { value: "Northwind" } });
    fireEvent.click(screen.getByRole("button", { name: /save settings/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "http://api.test/admin/settings",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
    const patchCall = fetchMock.mock.calls.find((call) => {
      const init = call[1] as RequestInit | undefined;
      return init?.method === "PATCH";
    });
    expect(JSON.parse(String(patchCall?.[1] && (patchCall[1] as RequestInit).body))).toEqual(
      expect.objectContaining({ appName: "Northwind" }),
    );
  });

  it("composes the default theme through useUI", () => {
    const source = readFileSync(resolve(import.meta.dirname, "./settings-page.tsx"), "utf8");
    expect(source).toContain("useUI");
    expect(source).toContain("AdminSettingsPage: View");
    expect(source).not.toMatch(/@\/themes\//);
    expect(defaultComponents.AdminSettingsPage).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsApplicationTab).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsThemeTab).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsAuthenticationTab).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsSmtpTab).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsStorageTab).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsSecurityTab).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsBillingTab).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsToggle).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsSecretField).toBeTypeOf("function");
    expect(defaultComponents.AdminSettingsIconUploader).toBeTypeOf("function");
  });

  it("lets a theme override a settings composite", async () => {
    mockSettingsApis();
    const OverrideTab: UIComponents["AdminSettingsApplicationTab"] = () => (
      <div data-testid="override-application-tab">Custom application tab</div>
    );

    await renderSettings({ AdminSettingsApplicationTab: OverrideTab });

    expect(await screen.findByTestId("override-application-tab")).toBeInTheDocument();
    expect(screen.queryByLabelText(/application name/i)).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /application/i })).toBeInTheDocument();
  });
});

import { generateKey } from "@fluxo/crypto";
import type { FluxoLogger } from "@fluxo/logger";
import type { AppSettingsAdminResponse, AppSettingsPublic } from "@fluxo/types";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { createMemoryAuth } from "../auth/stores/memory.js";
import type { Mailer } from "../settings/mailer.js";

function mockLogger(): FluxoLogger {
  const logger: FluxoLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };
  return logger;
}

function setup(options?: Parameters<typeof createMemoryAuth>[0]) {
  const sent: Array<{ to: string; subject: string; host?: string }> = [];
  const mailer: Mailer = {
    async send(message, smtp) {
      sent.push({ to: message.to, subject: message.subject, host: smtp.host });
    },
  };
  const captchaVerifier = options?.captchaVerifier ?? (async () => true);
  const auth = createMemoryAuth({
    appKey: options?.appKey ?? generateKey(),
    mailer,
    captchaVerifier,
    ...options,
  });
  const app = createApp({
    logger: mockLogger(),
    redis: { ping: async () => "PONG" },
    postgres: { ping: async () => undefined },
    corsOrigin: "http://localhost:5173",
    auth,
  });
  return { app, sent, ...auth };
}

function sessionCookie(response: Response): string {
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((value) => value.startsWith("fluxo.sid="));
  if (!session) {
    throw new Error("missing fluxo.sid cookie");
  }
  return session.split(";", 1)[0] ?? session;
}

async function register(
  app: ReturnType<typeof createApp>,
  overrides?: Record<string, unknown>,
) {
  return app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "ada",
      email: "ada@example.com",
      password: "password12",
      firstName: "Ada",
      lastName: "Lovelace",
      ...overrides,
    }),
  });
}

async function login(
  app: ReturnType<typeof createApp>,
  overrides?: Record<string, unknown>,
) {
  return app.request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username: "ada",
      password: "password12",
      rememberMe: true,
      ...overrides,
    }),
  });
}

async function signedInAdmin() {
  const ctx = setup();
  await register(ctx.app);
  const loggedIn = await login(ctx.app);
  return { ...ctx, cookie: sessionCookie(loggedIn) };
}

describe("settings api", () => {
  it("returns a public subset without secrets", async () => {
    const { app } = setup();
    const response = await app.request("/settings/public");
    expect(response.status).toBe(200);
    const body = (await response.json()) as AppSettingsPublic;
    expect(body.appName).toBe("Fluxo");
    expect(body.activeThemeId).toBe("default");
    expect(body.billingCurrency).toBe("USD");
    expect(JSON.stringify(body)).not.toContain("Pass");
    expect(JSON.stringify(body)).not.toContain("Secret");
    expect(JSON.stringify(body)).not.toContain("smtp");
  });

  it("requires an admin session to read and write settings", async () => {
    const { app } = setup();
    expect((await app.request("/admin/settings")).status).toBe(401);

    await register(app);
    await register(app, { username: "bob", email: "bob@example.com" });
    const memberLogin = await login(app, { username: "bob" });
    const member = await app.request("/admin/settings", {
      headers: { cookie: sessionCookie(memberLogin) },
    });
    expect(member.status).toBe(403);
  });

  it("patches settings and never returns raw secrets", async () => {
    const { app, cookie } = await signedInAdmin();
    const patched = await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        appName: "Northwind",
        emailSmtpHost: "smtp.example.com",
        emailSmtpPort: 587,
        emailSmtpUser: "fluxo",
        emailSmtpPass: "super-secret-pass",
        s3AccessKeyId: "access-key",
        s3SecretAccessKey: "secret-key",
        securityCaptchaSecretKey: "captcha-secret",
        billingInvoicePrefix: "NW",
        billingInvoiceDueDays: 21,
        billingTaxEnabled: true,
        billingTaxRate: 20,
        billingTaxLabel: "VAT",
      }),
    });
    expect(patched.status).toBe(200);
    const body = (await patched.json()) as AppSettingsAdminResponse;
    expect(body.settings.appName).toBe("Northwind");
    expect(body.settings.emailSmtpPassSet).toBe(true);
    expect(body.settings.s3AccessKeyIdSet).toBe(true);
    expect(body.settings.s3SecretAccessKeySet).toBe(true);
    expect(body.settings.securityCaptchaSecretKeySet).toBe(true);
    expect(body.settings.billingInvoicePrefix).toBe("NW");
    expect(body.themes.map((theme) => theme.id)).toEqual(["default", "example"]);
    expect(JSON.stringify(body)).not.toContain("super-secret-pass");
    expect(JSON.stringify(body)).not.toContain("secret-key");
    expect(JSON.stringify(body)).not.toContain("captcha-secret");
  });

  it("leaves omitted secrets unchanged and clears explicit nulls", async () => {
    const { app, cookie } = await signedInAdmin();
    await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ emailSmtpPass: "keep-me", s3SecretAccessKey: "also-keep" }),
    });
    const omitted = await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ appName: "Kept", emailSmtpPass: "", s3SecretAccessKey: undefined }),
    });
    const omittedBody = (await omitted.json()) as AppSettingsAdminResponse;
    expect(omittedBody.settings.emailSmtpPassSet).toBe(true);
    expect(omittedBody.settings.s3SecretAccessKeySet).toBe(true);

    const cleared = await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ emailSmtpPass: null, s3SecretAccessKey: null }),
    });
    const clearedBody = (await cleared.json()) as AppSettingsAdminResponse;
    expect(clearedBody.settings.emailSmtpPassSet).toBe(false);
    expect(clearedBody.settings.s3SecretAccessKeySet).toBe(false);
  });

  it("rejects unknown theme ids", async () => {
    const { app, cookie } = await signedInAdmin();
    const response = await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ activeThemeId: "does-not-exist" }),
    });
    expect(response.status).toBe(400);
  });

  it("switches the active theme to a catalog id", async () => {
    const { app, cookie } = await signedInAdmin();
    const response = await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ activeThemeId: "example" }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as AppSettingsAdminResponse;
    expect(body.settings.activeThemeId).toBe("example");
    const pub = await app.request("/settings/public");
    expect(((await pub.json()) as AppSettingsPublic).activeThemeId).toBe("example");
  });

  it("uploads and deletes the app icon", async () => {
    const { app, cookie } = await signedInAdmin();
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const form = new FormData();
    form.set("file", new File([png], "icon.png", { type: "image/png" }));
    const uploaded = await app.request("/admin/settings/icon", {
      method: "POST",
      headers: { cookie },
      body: form,
    });
    expect(uploaded.status).toBe(200);
    const uploadedBody = (await uploaded.json()) as AppSettingsAdminResponse;
    expect(uploadedBody.settings.appIconUrl).toContain("/files/branding/app-icon");
    expect(uploadedBody.settings.appIconUrl).toMatch(/\?v=/);

    const other = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    );
    const replace = new FormData();
    replace.set("file", new File([other], "icon-2.png", { type: "image/png" }));
    const replaced = await app.request("/admin/settings/icon", {
      method: "POST",
      headers: { cookie },
      body: replace,
    });
    expect(replaced.status).toBe(200);
    const replacedBody = (await replaced.json()) as AppSettingsAdminResponse;
    expect(replacedBody.settings.appIconUrl).toContain("/files/branding/app-icon");
    expect(replacedBody.settings.appIconUrl).not.toBe(uploadedBody.settings.appIconUrl);

    const removed = await app.request("/admin/settings/icon", {
      method: "DELETE",
      headers: { cookie },
    });
    expect(removed.status).toBe(200);
    expect(((await removed.json()) as AppSettingsAdminResponse).settings.appIconUrl).toBeNull();
  });
});

describe("settings auth enforcement", () => {
  it("blocks registration when disabled", async () => {
    const { app, cookie } = await signedInAdmin();
    await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ authDisableRegistration: true }),
    });
    const blocked = await register(app, { username: "cara", email: "cara@example.com" });
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toEqual({ code: "registration_disabled" });
  });

  it("blocks non-admin login when login is disabled", async () => {
    const { app, cookie } = await signedInAdmin();
    await register(app, { username: "bob", email: "bob@example.com" });
    await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ authDisableLogin: true }),
    });
    const member = await login(app, { username: "bob" });
    expect(member.status).toBe(403);
    expect(await member.json()).toEqual({ code: "login_disabled" });
    const admin = await login(app);
    expect(admin.status).toBe(200);
  });

  it("skips email verification when the requirement is disabled", async () => {
    const ctx = setup({ nodeEnv: "production" });
    await ctx.settings.patch({ authDisableEmailVerificationRequirement: true });
    const created = await register(ctx.app);
    expect(created.status).toBe(201);
    const loggedIn = await login(ctx.app);
    expect(loggedIn.status).toBe(200);
  });

  it("blocks password changes when disabled", async () => {
    const { app, cookie } = await signedInAdmin();
    await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ authDisablePasswordChange: true }),
    });
    const forgot = await app.request("/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "ada@example.com" }),
    });
    expect(forgot.status).toBe(403);
    const change = await app.request("/auth/password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ currentPassword: "password12", newPassword: "password99" }),
    });
    expect(change.status).toBe(403);
  });

  it("blocks MFA setup when disabled", async () => {
    const { app, cookie } = await signedInAdmin();
    await app.request("/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ authDisableMfa: true }),
    });
    const setupMfa = await app.request("/auth/mfa/setup", {
      method: "POST",
      headers: { cookie },
    });
    expect(setupMfa.status).toBe(403);
    expect(await setupMfa.json()).toEqual({ code: "mfa_disabled" });
  });

  it("stops outgoing auth email when requested", async () => {
    const ctx = setup({ nodeEnv: "production" });
    await ctx.settings.patch({
      authStopOutgoingEmails: true,
      emailSmtpHost: "smtp.example.com",
      emailFromAddress: "noreply@example.com",
    });
    const created = await register(ctx.app);
    expect(created.status).toBe(201);
    expect(ctx.sent).toHaveLength(0);
  });

  it("sends confirm mail through configured SMTP", async () => {
    const ctx = setup({ nodeEnv: "production" });
    await ctx.settings.patch({
      emailSmtpHost: "smtp.example.com",
      emailSmtpPort: 587,
      emailFromAddress: "Fluxo <noreply@example.com>",
    });
    const created = await register(ctx.app);
    expect(created.status).toBe(201);
    expect(ctx.sent).toEqual([
      expect.objectContaining({
        to: "ada@example.com",
        host: "smtp.example.com",
      }),
    ]);
  });

  it("requires a valid captcha token when captcha is enabled", async () => {
    const verifier = vi.fn(async (input: { token: string }) => input.token === "ok-token");
    const ctx = setup({ captchaVerifier: verifier });
    await register(ctx.app);
    await ctx.settings.patch({
      securityCaptchaEnabled: true,
      securityCaptchaType: "turnstile",
      securityCaptchaSecretKey: "site-secret",
    });
    const missing = await login(ctx.app);
    expect(missing.status).toBe(400);
    expect(await missing.json()).toEqual({ code: "captcha_required" });
    const invalid = await login(ctx.app, { captchaToken: "bad" });
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ code: "captcha_invalid" });
    const ok = await login(ctx.app, { captchaToken: "ok-token" });
    expect(ok.status).toBe(200);
  });
});

import { describe, expect, it } from "vitest";
import { loadEnv } from "./env.js";

const required = {
  REDIS_URL: "redis://localhost:6379",
  POSTGRES_URL: "postgres://fluxo:fluxo@localhost:5432/fluxo",
} as const;

describe("loadEnv", () => {
  it("applies documented defaults", () => {
    const env = loadEnv({ ...required });

    expect(env.NODE_ENV).toBe("development");
    expect(env.PORT).toBe(3000);
    expect(env.FRONTEND_URL).toBe("http://localhost:5173");
    expect(env.API_URL).toBe("http://localhost:3000");
    expect(env.APP_NAME).toBe("Fluxo");
    expect(env.SESSION_LIFETIME).toBe(7);
    expect(env.BCRYPT_ROUNDS).toBe(12);
    expect(env.COOKIE_DOMAIN).toBeUndefined();
    expect(env.POSTGRES_URL).toBe(required.POSTGRES_URL);
    expect(env.STORAGE_PROVIDER).toBe("local");
    expect(env.S3_FORCE_PATH_STYLE).toBe(true);
    expect(env.PLUGINS_DIR).toBe("./plugins");
    expect(env.PLUGIN_HTTP_ALLOWLIST).toEqual([]);
  });

  it("requires REDIS_URL", () => {
    expect(() => loadEnv({ POSTGRES_URL: required.POSTGRES_URL })).toThrow();
  });

  it("requires POSTGRES_URL", () => {
    expect(() => loadEnv({ REDIS_URL: required.REDIS_URL })).toThrow();
  });

  it("parses SMTP, storage, and plugin fields", () => {
    const env = loadEnv({
      ...required,
      NODE_ENV: "production",
      PORT: "8080",
      FRONTEND_URL: "https://panel.example.com",
      API_URL: "https://api.example.com",
      APP_NAME: "Acme",
      APP_KEY: "app-key",
      SESSION_SECRET: "session-secret",
      SESSION_LIFETIME: "14",
      BCRYPT_ROUNDS: "13",
      COOKIE_DOMAIN: ".example.com",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_USER: "fluxo",
      SMTP_PASS: "secret",
      EMAIL_FROM: "Fluxo <noreply@example.com>",
      STORAGE_PROVIDER: "s3",
      S3_ENDPOINT: "https://s3.example.com",
      S3_REGION: "us-east-1",
      S3_BUCKET: "fluxo",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret",
      S3_FORCE_PATH_STYLE: "false",
      S3_PUBLIC_URL_BASE: "https://cdn.example.com",
      PLUGINS_DIR: "/var/fluxo/plugins",
      PLUGIN_HTTP_ALLOWLIST: "panel.example.com, 10.0.0.12",
    });

    expect(env.NODE_ENV).toBe("production");
    expect(env.PORT).toBe(8080);
    expect(env.FRONTEND_URL).toBe("https://panel.example.com");
    expect(env.COOKIE_DOMAIN).toBe(".example.com");
    expect(env.SMTP_PORT).toBe(465);
    expect(env.STORAGE_PROVIDER).toBe("s3");
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
    expect(env.S3_PUBLIC_URL_BASE).toBe("https://cdn.example.com");
    expect(env.PLUGINS_DIR).toBe("/var/fluxo/plugins");
    expect(env.PLUGIN_HTTP_ALLOWLIST).toEqual(["panel.example.com", "10.0.0.12"]);
  });

  it("strips a trailing slash from FRONTEND_URL for CORS origin matching", () => {
    const env = loadEnv({
      ...required,
      FRONTEND_URL: "https://panel.example.com/",
    });

    expect(env.FRONTEND_URL).toBe("https://panel.example.com");
  });

  it("rejects s3 storage without credentials", () => {
    expect(() =>
      loadEnv({
        ...required,
        STORAGE_PROVIDER: "s3",
      }),
    ).toThrow(/S3_BUCKET/);
  });
});

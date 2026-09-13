import { z } from "zod";

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const storageProviderSchema = z.enum(["local", "s3"]);

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default("development"),
    PORT: z.number().int().positive().default(3000),
    FRONTEND_URL: z
      .string()
      .min(1)
      .default("http://localhost:5173")
      .transform((value) => value.replace(/\/$/, "")),
    API_URL: z.string().min(1).default("http://localhost:3000"),
    APP_NAME: z.string().min(1).default("Fluxo"),
    APP_KEY: z.string().default(""),
    SESSION_SECRET: z.string().default(""),
    SESSION_LIFETIME: z.number().int().positive().default(7),
    BCRYPT_ROUNDS: z.number().int().min(10).max(15).default(12),
    COOKIE_DOMAIN: z.string().optional(),
    POSTGRES_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.number().int().min(1).max(65535).optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    STORAGE_PROVIDER: storageProviderSchema.default("local"),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: z.boolean().default(true),
    S3_PUBLIC_URL_BASE: z.string().optional(),
    PLUGINS_DIR: z.string().min(1).default("./plugins"),
    PLUGIN_HTTP_ALLOWLIST: z.array(z.string().min(1)).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.STORAGE_PROVIDER !== "s3") {
      return;
    }

    const required = [
      "S3_BUCKET",
      "S3_REGION",
      "S3_ACCESS_KEY_ID",
      "S3_SECRET_ACCESS_KEY",
    ] as const;

    for (const key of required) {
      if (data[key] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: `${key} is required when STORAGE_PROVIDER=s3`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

function optionalString(value: string | undefined): string | undefined {
  return value === undefined || value.length === 0 ? undefined : value;
}

function parseInteger(
  value: string | undefined,
  fallback?: number,
): number | undefined {
  if (value === undefined || value.length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.length === 0) {
    return fallback;
  }

  if (value === "true" || value === "1") {
    return true;
  }

  if (value === "false" || value === "0") {
    return false;
  }

  return fallback;
}

function parseAllowlist(value: string | undefined): string[] {
  if (value === undefined || value.length === 0) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse({
    NODE_ENV: optionalString(source.NODE_ENV),
    PORT: parseInteger(source.PORT, 3000),
    FRONTEND_URL: optionalString(source.FRONTEND_URL),
    API_URL: optionalString(source.API_URL),
    APP_NAME: optionalString(source.APP_NAME),
    APP_KEY: source.APP_KEY ?? "",
    SESSION_SECRET: source.SESSION_SECRET ?? "",
    SESSION_LIFETIME: parseInteger(source.SESSION_LIFETIME, 7),
    BCRYPT_ROUNDS: parseInteger(source.BCRYPT_ROUNDS, 12),
    COOKIE_DOMAIN: optionalString(source.COOKIE_DOMAIN),
    POSTGRES_URL: source.POSTGRES_URL,
    REDIS_URL: source.REDIS_URL,
    SMTP_HOST: optionalString(source.SMTP_HOST),
    SMTP_PORT: parseInteger(source.SMTP_PORT),
    SMTP_USER: optionalString(source.SMTP_USER),
    SMTP_PASS: optionalString(source.SMTP_PASS),
    EMAIL_FROM: optionalString(source.EMAIL_FROM),
    STORAGE_PROVIDER: optionalString(source.STORAGE_PROVIDER),
    S3_ENDPOINT: optionalString(source.S3_ENDPOINT),
    S3_REGION: optionalString(source.S3_REGION),
    S3_BUCKET: optionalString(source.S3_BUCKET),
    S3_ACCESS_KEY_ID: optionalString(source.S3_ACCESS_KEY_ID),
    S3_SECRET_ACCESS_KEY: optionalString(source.S3_SECRET_ACCESS_KEY),
    S3_FORCE_PATH_STYLE: parseBoolean(source.S3_FORCE_PATH_STYLE, true),
    S3_PUBLIC_URL_BASE: optionalString(source.S3_PUBLIC_URL_BASE),
    PLUGINS_DIR: optionalString(source.PLUGINS_DIR),
    PLUGIN_HTTP_ALLOWLIST: parseAllowlist(source.PLUGIN_HTTP_ALLOWLIST),
  });
}

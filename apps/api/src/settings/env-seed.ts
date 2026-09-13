import type { Env } from "../env.js";
import type { SettingsEnvSeed } from "./defaults.js";

export function envToSettingsSeed(env: Env): SettingsEnvSeed {
  return {
    appName: env.APP_NAME,
    appBaseUrl: env.FRONTEND_URL,
    apiUrl: env.API_URL,
    appKey: env.APP_KEY,
    smtpHost: env.SMTP_HOST,
    smtpPort: env.SMTP_PORT,
    smtpUser: env.SMTP_USER,
    smtpPass: env.SMTP_PASS,
    emailFrom: env.EMAIL_FROM,
    storageProvider: env.STORAGE_PROVIDER,
    s3Endpoint: env.S3_ENDPOINT,
    s3Region: env.S3_REGION,
    s3Bucket: env.S3_BUCKET,
    s3AccessKeyId: env.S3_ACCESS_KEY_ID,
    s3SecretAccessKey: env.S3_SECRET_ACCESS_KEY,
    s3ForcePathStyle: env.S3_FORCE_PATH_STYLE,
    s3PublicUrlBase: env.S3_PUBLIC_URL_BASE,
  };
}

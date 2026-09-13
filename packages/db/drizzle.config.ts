import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "drizzle-kit";

const rootEnvPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env");
if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

const url = process.env.POSTGRES_URL;
if (url === undefined || url.length === 0) {
  throw new Error("POSTGRES_URL is missing. Set it in the repository root .env");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url,
  },
});

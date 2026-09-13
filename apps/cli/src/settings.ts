import { randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { FluxoLogger } from "@fluxo/logger";
import type { FluxoSettings } from "@fluxo/types";

export function resolveSettingsPath(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.FLUXO_CONFIG_PATH?.trim();
  if (configured) {
    return configured;
  }

  return path.join(homedir(), ".fluxo", "settings.json");
}

export async function readSettings(filePath: string): Promise<FluxoSettings> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const settings: FluxoSettings = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string") {
        settings[key] = value;
      }
    }
    return settings;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function writeSettings(filePath: string, settings: FluxoSettings): Promise<void> {
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true });
  const payload = `${JSON.stringify(settings, null, 2)}\n`;
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${randomBytes(8).toString("hex")}.tmp`,
  );
  const handle = await open(tempPath, "wx", 0o600);
  try {
    await handle.writeFile(payload);
    await handle.close();
    await rename(tempPath, filePath);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export async function handleSettingsList(logger: FluxoLogger, filePath: string): Promise<void> {
  const settings = await readSettings(filePath);
  const keys = Object.keys(settings);
  logger.info("settings", { keys, count: keys.length });
}

export async function handleSettingsGet(
  logger: FluxoLogger,
  filePath: string,
  key: string,
): Promise<void> {
  const settings = await readSettings(filePath);
  if (settings[key] === undefined) {
    logger.warn("setting not found", { key });
    return;
  }
  logger.info("setting", { key });
}

export async function handleSettingsSet(
  logger: FluxoLogger,
  filePath: string,
  key: string,
  value: string,
): Promise<void> {
  const settings = await readSettings(filePath);
  settings[key] = value;
  await writeSettings(filePath, settings);
  logger.info("setting updated", { key });
}

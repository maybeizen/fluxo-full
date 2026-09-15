import { ForgeValidationError } from "./errors.js";
import type { PluginId } from "./identity.js";
import { parsePluginId } from "./identity.js";

export const FORGE_WEBHOOK_PATH_PREFIX = "/forge/webhooks";

const WEBHOOK_NAME_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const INSTANCE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSafeWebhookName(value: string): boolean {
  return WEBHOOK_NAME_PATTERN.test(value);
}

export function parseWebhookName(value: unknown): string {
  if (typeof value !== "string" || !isSafeWebhookName(value)) {
    throw new ForgeValidationError("Invalid webhook name");
  }
  return value;
}

export function parseInstanceId(value: unknown): string {
  if (typeof value !== "string" || !INSTANCE_ID_PATTERN.test(value)) {
    throw new ForgeValidationError("Invalid instance id");
  }
  return value;
}

export function forgeWebhookPath(
  pluginId: PluginId,
  instanceId: string,
  name: string,
): string {
  const id = parsePluginId(pluginId);
  const instance = parseInstanceId(instanceId);
  const webhook = parseWebhookName(name);
  return `${FORGE_WEBHOOK_PATH_PREFIX}/${id}/${instance}/${webhook}`;
}

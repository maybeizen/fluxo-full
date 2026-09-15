import { ForgeValidationError } from "./errors.js";

export const PLUGIN_TYPES = ["service", "gateway", "panel"] as const;

export type PluginType = (typeof PLUGIN_TYPES)[number];

export type PluginId = string;

export const PLUGIN_ID_MAX_LENGTH = 80;

export const PLUGIN_ID_PATTERN =
  /^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.[a-z][a-z0-9]*(-[a-z0-9]+)*){0,2}$/;

export function isPluginId(value: string): value is PluginId {
  return (
    value.length > 0 &&
    value.length <= PLUGIN_ID_MAX_LENGTH &&
    PLUGIN_ID_PATTERN.test(value) &&
    !value.includes("..") &&
    !value.includes("/") &&
    !value.includes("\\")
  );
}

export function parsePluginId(value: unknown): PluginId {
  if (typeof value !== "string" || !isPluginId(value)) {
    throw new ForgeValidationError("Invalid plugin id");
  }
  return value;
}

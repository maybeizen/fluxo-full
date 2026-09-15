import type { JsonValue, PluginConfigField } from "@fluxo/forge";
import type { PluginSecretDraft } from "./types";

export type ConfigDraftErrorCode =
  "required" | "type" | "min" | "max" | "option";

export interface ConfigDraftError {
  key: string;
  label: string;
  code: ConfigDraftErrorCode;
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function urlLooksValid(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function emailLooksValid(value: string): boolean {
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@")) {
    return false;
  }
  const domain = value.slice(at + 1);
  return (
    domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".")
  );
}

export function validatePluginConfigDraft(
  schema: readonly PluginConfigField[],
  values: Readonly<Record<string, JsonValue | undefined>>,
  secrets: Readonly<Record<string, PluginSecretDraft>>,
  secretKeysSet: readonly string[],
): ConfigDraftError[] {
  const errors: ConfigDraftError[] = [];
  for (const field of schema) {
    if (field.type === "secret") {
      const draft = secrets[field.key] ?? { value: "", clear: false };
      const hasSaved = secretKeysSet.includes(field.key) && !draft.clear;
      const hasNew = draft.value.length > 0;
      if (field.required === true && !hasSaved && !hasNew) {
        errors.push({ key: field.key, label: field.label, code: "required" });
      }
      continue;
    }

    const raw = values[field.key];
    if (isBlank(raw)) {
      if (field.required === true && field.type !== "boolean") {
        errors.push({ key: field.key, label: field.label, code: "required" });
      }
      continue;
    }

    switch (field.type) {
      case "text":
      case "textarea": {
        if (typeof raw !== "string") {
          errors.push({ key: field.key, label: field.label, code: "type" });
          break;
        }
        if (
          field.type === "text" &&
          field.minLength !== undefined &&
          raw.length < field.minLength
        ) {
          errors.push({ key: field.key, label: field.label, code: "min" });
        }
        if (field.maxLength !== undefined && raw.length > field.maxLength) {
          errors.push({ key: field.key, label: field.label, code: "max" });
        }
        break;
      }
      case "number": {
        const parsed = asFiniteNumber(raw);
        if (parsed === undefined) {
          errors.push({ key: field.key, label: field.label, code: "type" });
          break;
        }
        if (field.integer === true && !Number.isInteger(parsed)) {
          errors.push({ key: field.key, label: field.label, code: "type" });
        }
        if (field.min !== undefined && parsed < field.min) {
          errors.push({ key: field.key, label: field.label, code: "min" });
        }
        if (field.max !== undefined && parsed > field.max) {
          errors.push({ key: field.key, label: field.label, code: "max" });
        }
        break;
      }
      case "boolean": {
        if (raw !== true && raw !== false) {
          errors.push({ key: field.key, label: field.label, code: "type" });
        }
        break;
      }
      case "url": {
        if (typeof raw !== "string" || !urlLooksValid(raw)) {
          errors.push({ key: field.key, label: field.label, code: "type" });
        }
        break;
      }
      case "email": {
        if (typeof raw !== "string" || !emailLooksValid(raw)) {
          errors.push({ key: field.key, label: field.label, code: "type" });
        }
        break;
      }
      case "select": {
        if (
          typeof raw !== "string" ||
          !field.options.some((option) => option.value === raw)
        ) {
          errors.push({ key: field.key, label: field.label, code: "option" });
        }
        break;
      }
      case "multiselect": {
        if (
          !Array.isArray(raw) ||
          raw.some((item) => typeof item !== "string")
        ) {
          errors.push({ key: field.key, label: field.label, code: "type" });
          break;
        }
        const selected = raw.filter(
          (item): item is string => typeof item === "string",
        );
        const allowed = new Set(field.options.map((option) => option.value));
        if (selected.some((item) => !allowed.has(item))) {
          errors.push({ key: field.key, label: field.label, code: "option" });
        }
        break;
      }
      default:
        break;
    }
  }
  return errors;
}

export function buildConfigPayload(
  schema: readonly PluginConfigField[],
  values: Readonly<Record<string, JsonValue | undefined>>,
  secrets: Readonly<Record<string, PluginSecretDraft>>,
): Record<string, JsonValue | null> {
  const payload: Record<string, JsonValue | null> = {};
  for (const field of schema) {
    if (field.type === "secret") {
      const draft = secrets[field.key] ?? { value: "", clear: false };
      if (draft.clear) {
        payload[field.key] = null;
      } else if (draft.value.length > 0) {
        payload[field.key] = draft.value;
      }
      continue;
    }
    const raw = values[field.key];
    if (raw === undefined) {
      continue;
    }
    payload[field.key] = raw;
  }
  return payload;
}

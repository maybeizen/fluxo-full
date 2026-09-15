import { z } from "zod";
import { isForbiddenObjectKey } from "./security.js";

export const PLUGIN_CONFIG_FIELD_TYPES = [
  "text",
  "secret",
  "number",
  "boolean",
  "url",
  "email",
  "select",
  "multiselect",
  "textarea",
] as const;

export type PluginConfigFieldType = (typeof PLUGIN_CONFIG_FIELD_TYPES)[number];

export const safeConfigKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/)
  .refine((key) => !isForbiddenObjectKey(key), {
    message: "Forbidden config key",
  });

const selectOptionSchema = z.object({
  value: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
});

const fieldBase = {
  key: safeConfigKeySchema,
  label: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
  required: z.boolean().optional(),
};

export const pluginConfigFieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...fieldBase,
    type: z.literal("text"),
    default: z.string().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(1).max(2000).optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("secret"),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("number"),
    default: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("boolean"),
    default: z.boolean().optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("url"),
    default: z.string().url().optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("email"),
    default: z.string().email().optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("select"),
    options: z.array(selectOptionSchema).min(1),
    default: z.string().optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("multiselect"),
    options: z.array(selectOptionSchema).min(1),
    default: z.array(z.string()).optional(),
  }),
  z.object({
    ...fieldBase,
    type: z.literal("textarea"),
    default: z.string().optional(),
    maxLength: z.number().int().min(1).max(20000).optional(),
  }),
]);

export type PluginConfigField = z.infer<typeof pluginConfigFieldSchema>;

export function isSensitiveConfigKey(
  key: string,
  fields: readonly PluginConfigField[],
): boolean {
  return fields.some((field) => field.key === key && field.type === "secret");
}

export interface PluginConfig {
  get(key: string): import("./json.js").JsonValue | undefined;
  getSecret(key: string): string | undefined;
  all(): Readonly<Record<string, import("./json.js").JsonValue>>;
}

export interface PluginConfigPublic {
  values: Readonly<Record<string, import("./json.js").JsonValue>>;
  secretKeysSet: readonly string[];
}

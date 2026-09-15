import { z } from "zod";
import { pluginConfigFieldSchema } from "./config.js";
import { ForgeManifestError } from "./errors.js";
import {
  PLUGIN_ID_MAX_LENGTH,
  PLUGIN_ID_PATTERN,
  PLUGIN_TYPES,
} from "./identity.js";
import { PANEL_EXTENSION_POINTS } from "./panel.js";
import { PLUGIN_PERMISSIONS } from "./permissions.js";
import { assertNoPrototypePollution, isSafeRelativeEntry } from "./security.js";

const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const forgeApiRangeSchema = z.string().regex(/^[\^~]?\d+\.\d+\.\d+$/);

const relativeEntrySchema = z.string().refine(isSafeRelativeEntry, {
  message: "entry must be a relative path without traversal",
});

const contributionIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/);

const pluginDependencySchema = z.object({
  pluginId: z
    .string()
    .min(1)
    .max(PLUGIN_ID_MAX_LENGTH)
    .regex(PLUGIN_ID_PATTERN),
  forgeApi: forgeApiRangeSchema.optional(),
});

const panelContributionManifestSchema = z.object({
  point: z.enum(PANEL_EXTENSION_POINTS),
  contributionId: contributionIdSchema,
  title: z.string().min(1).max(80).optional(),
  order: z.number().int().optional(),
});

function uniqueKeys(
  fields: { key: string }[],
  label: string,
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const field of fields) {
    if (seen.has(field.key)) {
      ctx.addIssue({
        code: "custom",
        message: `Duplicate ${label} key: ${field.key}`,
      });
    }
    seen.add(field.key);
  }
}

export const pluginManifestSchema = z
  .object({
    id: z.string().min(1).max(PLUGIN_ID_MAX_LENGTH).regex(PLUGIN_ID_PATTERN),
    name: z.string().min(1).max(80),
    version: semverSchema,
    type: z.enum(PLUGIN_TYPES),
    forgeApi: forgeApiRangeSchema,
    entry: relativeEntrySchema,
    description: z.string().max(500).optional(),
    author: z.string().max(80).optional(),
    homepage: z.string().url().optional(),
    frontend: relativeEntrySchema.optional(),
    config: z.array(pluginConfigFieldSchema).max(64).optional(),
    permissions: z.array(z.enum(PLUGIN_PERMISSIONS)).optional(),
    requires: z.array(pluginDependencySchema).max(16).optional(),
    contributions: z.array(panelContributionManifestSchema).max(32).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.config) {
      uniqueKeys(value.config, "config", ctx);
    }
    if (value.permissions) {
      const seen = new Set<string>();
      for (const permission of value.permissions) {
        if (seen.has(permission)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate permission: ${permission}`,
          });
        }
        seen.add(permission);
      }
    }
    if (value.type === "panel") {
      const hasFrontend = value.frontend !== undefined;
      const hasContributions = (value.contributions?.length ?? 0) > 0;
      if (!hasFrontend && !hasContributions) {
        ctx.addIssue({
          code: "custom",
          path: ["frontend"],
          message: "panel plugins must declare frontend or contributions",
        });
      }
    }
  });

export type PluginManifest = z.infer<typeof pluginManifestSchema>;

export type PluginDependency = z.infer<typeof pluginDependencySchema>;

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "manifest";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function parsePluginManifest(input: unknown): PluginManifest {
  try {
    assertNoPrototypePollution(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid manifest";
    throw new ForgeManifestError(message);
  }

  const parsed = pluginManifestSchema.safeParse(input);
  if (!parsed.success) {
    throw new ForgeManifestError(formatZodError(parsed.error));
  }
  return parsed.data;
}

export function safeParsePluginManifest(
  input: unknown,
): { ok: true; data: PluginManifest } | { ok: false; error: string } {
  try {
    return { ok: true, data: parsePluginManifest(input) };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid manifest";
    return { ok: false, error: message };
  }
}

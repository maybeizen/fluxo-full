import {
  PLUGIN_PERMISSIONS,
  pluginConfigFieldSchema,
  jsonValueSchema,
  type JsonValue,
} from "@fluxo/forge";
import { z } from "zod";
import type {
  AdminPluginConfigView,
  AdminPluginDetail,
  AdminPluginInstancesResponse,
  AdminPluginListItem,
  AdminPluginListResponse,
} from "./types";

const pluginTypeSchema = z.enum(["service", "gateway", "panel"]);
const lifecycleSchema = z.enum(["installed", "disabled", "enabled", "started", "error"]);

export const adminPluginListItemSchema: z.ZodType<AdminPluginListItem> = z.object({
  id: z.string(),
  type: pluginTypeSchema,
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  author: z.string().optional(),
  forgeApi: z.string(),
  permissions: z.array(z.enum(PLUGIN_PERMISSIONS)),
  status: lifecycleSchema,
  error: z.string().optional(),
  instanceCount: z.number(),
  enabled: z.boolean(),
  installed: z.boolean(),
  discovered: z.boolean(),
  compatibility: z.object({
    ok: z.boolean(),
    forgeApi: z.string(),
    hostVersion: z.string(),
  }),
});

export const adminPluginListResponseSchema: z.ZodType<AdminPluginListResponse> = z.object({
  plugins: z.array(adminPluginListItemSchema),
});

export const adminPluginDetailSchema: z.ZodType<AdminPluginDetail> = adminPluginListItemSchema;

const jsonRecordSchema = z.record(z.string(), jsonValueSchema);

export const adminPluginConfigViewSchema: z.ZodType<AdminPluginConfigView> = z.object({
  schema: z.array(pluginConfigFieldSchema),
  values: jsonRecordSchema,
  secretKeysSet: z.array(z.string()),
});

export const adminPluginInstanceSchema = z.object({
  id: z.string(),
  pluginId: z.string(),
  kind: z.enum(["service", "gateway"]),
  displayName: z.string(),
  enabled: z.boolean(),
  config: z.object({
    values: jsonRecordSchema,
    secretKeysSet: z.array(z.string()),
  }),
});

export const adminPluginInstancesResponseSchema: z.ZodType<AdminPluginInstancesResponse> = z.object({
  instances: z.array(adminPluginInstanceSchema),
});

export const adminPluginHealthSchema = z.object({
  status: z.enum(["ok", "degraded", "unhealthy"]),
  message: z.string().optional(),
  pluginId: z.string(),
  instanceId: z.string().optional(),
  checkedAt: z.string(),
  latencyMs: z.number(),
});

export const adminOkSchema = z.object({
  ok: z.literal(true),
});

export type ConfigPayload = Record<string, JsonValue | null>;

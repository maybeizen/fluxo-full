import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const pluginTypeEnum = pgEnum("plugin_type", ["service", "gateway", "panel"]);

export const pluginLifecycleStatusEnum = pgEnum("plugin_lifecycle_status", [
  "installed",
  "disabled",
  "enabled",
  "started",
  "error",
]);

export const pluginInstanceKindEnum = pgEnum("plugin_instance_kind", ["service", "gateway"]);

export const pluginInstalls = pgTable("plugin_installs", {
  id: text("id").primaryKey(),
  type: pluginTypeEnum("type").notNull(),
  version: text("version").notNull(),
  enabled: boolean("enabled").notNull().default(false),
  status: pluginLifecycleStatusEnum("status").notNull().default("installed"),
  error: text("error"),
  discoveredPath: text("discovered_path"),
  contentHash: text("content_hash"),
  manifest: jsonb("manifest").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const pluginInstances = pgTable(
  "plugin_instances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pluginId: text("plugin_id")
      .notNull()
      .references(() => pluginInstalls.id, { onDelete: "restrict" }),
    kind: pluginInstanceKindEnum("kind").notNull(),
    displayName: text("display_name").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    config: jsonb("config").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("plugin_instances_plugin_id_idx").on(table.pluginId)],
);

export const pluginKv = pgTable(
  "plugin_kv",
  {
    pluginId: text("plugin_id").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.pluginId, table.key], name: "plugin_kv_plugin_id_key_pk" }),
    index("plugin_kv_plugin_id_idx").on(table.pluginId),
  ],
);

export const pluginSecrets = pgTable(
  "plugin_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pluginId: text("plugin_id").notNull(),
    instanceId: text("instance_id").notNull().default(""),
    key: text("key").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plugin_secrets_plugin_instance_key_idx").on(
      table.pluginId,
      table.instanceId,
      table.key,
    ),
    index("plugin_secrets_plugin_id_idx").on(table.pluginId),
  ],
);

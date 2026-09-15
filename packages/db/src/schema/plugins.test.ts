import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import {
  pluginInstalls,
  pluginInstances,
  pluginKv,
  pluginSecrets,
} from "./plugins.js";

describe("plugin schema", () => {
  it("defines plugin_installs", () => {
    expect(getTableName(pluginInstalls)).toBe("plugin_installs");
    const columns = getTableColumns(pluginInstalls);
    expect(columns.id).toBeDefined();
    expect(columns.type).toBeDefined();
    expect(columns.version).toBeDefined();
    expect(columns.enabled).toBeDefined();
    expect(columns.status).toBeDefined();
    expect(columns.error).toBeDefined();
    expect(columns.discoveredPath).toBeDefined();
    expect(columns.contentHash).toBeDefined();
    expect(columns.manifest).toBeDefined();
    expect(columns.createdAt).toBeDefined();
    expect(columns.updatedAt).toBeDefined();
  });

  it("defines plugin_instances with restrict delete against installs", () => {
    expect(getTableName(pluginInstances)).toBe("plugin_instances");
    const columns = getTableColumns(pluginInstances);
    expect(columns.id).toBeDefined();
    expect(columns.pluginId).toBeDefined();
    expect(columns.kind).toBeDefined();
    expect(columns.displayName).toBeDefined();
    expect(columns.enabled).toBeDefined();
    expect(columns.config).toBeDefined();
    const config = getTableConfig(pluginInstances);
    expect(config.foreignKeys).toHaveLength(1);
    expect(config.foreignKeys[0]?.onDelete).toBe("restrict");
    expect(config.foreignKeys[0]?.reference().foreignTable).toBe(
      pluginInstalls,
    );
  });

  it("defines plugin_kv without a foreign key so uninstall retains rows", () => {
    expect(getTableName(pluginKv)).toBe("plugin_kv");
    const columns = getTableColumns(pluginKv);
    expect(columns.pluginId).toBeDefined();
    expect(columns.key).toBeDefined();
    expect(columns.value).toBeDefined();
    expect(getTableConfig(pluginKv).foreignKeys).toHaveLength(0);
  });

  it("defines plugin_secrets without a foreign key so uninstall retains rows", () => {
    expect(getTableName(pluginSecrets)).toBe("plugin_secrets");
    const columns = getTableColumns(pluginSecrets);
    expect(columns.pluginId).toBeDefined();
    expect(columns.instanceId).toBeDefined();
    expect(columns.key).toBeDefined();
    expect(columns.payload).toBeDefined();
    expect(getTableConfig(pluginSecrets).foreignKeys).toHaveLength(0);
  });
});

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePluginManifest } from "@fluxo/forge";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "index.ts"),
  "utf8",
);
const PLUGIN_JSON = parsePluginManifest(
  JSON.parse(
    readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../plugin.json"),
      "utf8",
    ) as unknown,
  ),
);

describe("example-panel", () => {
  it("matches plugin.json and declares the admin dashboard widget", () => {
    expect(plugin.manifest).toEqual(PLUGIN_JSON);
    expect(plugin.manifest.id).toBe("example-panel");
    expect(plugin.manifest.type).toBe("panel");
    expect(SOURCE).not.toMatch(/@fluxo\/db|prisma|theme-system|@fluxo\/api/);
    expect(plugin.contributions?.()).toEqual([
      {
        point: "admin.dashboard.widget",
        contributionId: "status",
        title: "Example",
        order: 50,
      },
    ]);
  });
});

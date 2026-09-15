import { describe, expect, it } from "vitest";
import {
  ForgeManifestError,
  FORGE_API_VERSION,
  parsePluginManifest,
  safeParsePluginManifest,
} from "./index.js";

const valid = {
  id: "acme.pterodactyl",
  name: "Pterodactyl",
  version: "1.2.3",
  type: "service" as const,
  forgeApi: `^${FORGE_API_VERSION}`,
  entry: "dist/index.js",
  description: "Game server panel",
  author: "Acme",
  permissions: ["http.outbound", "service.provision"],
  config: [
    {
      type: "url" as const,
      key: "panel_url",
      label: "Panel URL",
      required: true,
    },
    {
      type: "secret" as const,
      key: "api_key",
      label: "API key",
      required: true,
    },
  ],
};

describe("parsePluginManifest", () => {
  it("accepts a valid service manifest", () => {
    expect(parsePluginManifest(valid).id).toBe("acme.pterodactyl");
  });

  it("rejects prototype pollution keys", () => {
    const withOwnKey: Record<string, unknown> = { ...valid };
    Object.defineProperty(withOwnKey, "__proto__", {
      value: { name: "pwned" },
      enumerable: true,
      configurable: true,
      writable: true,
    });
    expect(() => parsePluginManifest(withOwnKey)).toThrow(ForgeManifestError);
    expect(() =>
      parsePluginManifest({ ...valid, __proto__: { name: "pwned" } }),
    ).toThrow(ForgeManifestError);
  });

  it("rejects constructor keys on nested objects", () => {
    expect(
      safeParsePluginManifest({
        ...valid,
        config: [{ type: "text", key: "constructor", label: "Bad" }],
      }).ok,
    ).toBe(false);
  });

  it("rejects path traversal in entry", () => {
    expect(
      safeParsePluginManifest({ ...valid, entry: "../secret.js" }).ok,
    ).toBe(false);
    expect(safeParsePluginManifest({ ...valid, entry: "/etc/passwd" }).ok).toBe(
      false,
    );
  });

  it("rejects unknown type and unsafe id", () => {
    expect(safeParsePluginManifest({ ...valid, type: "theme" }).ok).toBe(false);
    expect(safeParsePluginManifest({ ...valid, id: "../etc" }).ok).toBe(false);
    expect(safeParsePluginManifest({ ...valid, id: "Acme.Panel" }).ok).toBe(
      false,
    );
  });

  it("rejects duplicate config keys and permissions", () => {
    expect(
      safeParsePluginManifest({
        ...valid,
        config: [
          { type: "text", key: "host", label: "Host" },
          { type: "text", key: "host", label: "Host 2" },
        ],
      }).ok,
    ).toBe(false);
    expect(
      safeParsePluginManifest({
        ...valid,
        permissions: ["http.outbound", "http.outbound"],
      }).ok,
    ).toBe(false);
  });

  it("requires panel frontend or contributions", () => {
    expect(
      safeParsePluginManifest({
        ...valid,
        id: "acme.status",
        type: "panel",
      }).ok,
    ).toBe(false);
    expect(
      safeParsePluginManifest({
        ...valid,
        id: "acme.status",
        type: "panel",
        contributions: [
          { point: "client.dashboard.services", contributionId: "status" },
        ],
      }).ok,
    ).toBe(true);
  });

  it("rejects unknown contribution points", () => {
    expect(
      safeParsePluginManifest({
        ...valid,
        id: "acme.status",
        type: "panel",
        contributions: [
          { point: "client.store.checkout", contributionId: "pay" },
        ],
      }).ok,
    ).toBe(false);
  });
});

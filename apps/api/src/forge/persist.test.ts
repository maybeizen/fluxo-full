import { generateKey } from "@fluxo/crypto";
import {
  ForgeConfigError,
  ForgeConflictError,
  ForgeValidationError,
  type PluginConfigField,
} from "@fluxo/forge";
import { describe, expect, it } from "vitest";
import {
  assertStorageCollection,
  assertStorageKey,
  createMemoryPluginPersist,
  createPluginStorage,
  toPluginConfigPublic,
  toPluginInstanceRecord,
  validatePluginConfig,
} from "./persist.js";

const mailManifest = {
  id: "acme.mail",
  name: "Mail",
  version: "1.0.0",
  type: "service" as const,
  forgeApi: "^0.1.0",
  entry: "index.js",
  permissions: ["storage.read", "storage.write"],
};

const dnsManifest = {
  id: "acme.dns",
  name: "DNS",
  version: "1.0.0",
  type: "service" as const,
  forgeApi: "^0.1.0",
  entry: "index.js",
};

const configSchema: PluginConfigField[] = [
  {
    key: "host",
    type: "text",
    label: "Host",
    required: true,
    minLength: 1,
    maxLength: 80,
  },
  {
    key: "port",
    type: "number",
    label: "Port",
    integer: true,
    min: 1,
    max: 65535,
    default: 25,
  },
  { key: "secure", type: "boolean", label: "Secure", default: false },
  { key: "api_token", type: "secret", label: "API token", required: true },
  {
    key: "region",
    type: "select",
    label: "Region",
    options: [
      { value: "us", label: "US" },
      { value: "eu", label: "EU" },
    ],
  },
  {
    key: "flags",
    type: "multiselect",
    label: "Flags",
    options: [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ],
  },
  { key: "webhook", type: "url", label: "Webhook" },
  { key: "contact", type: "email", label: "Contact" },
  { key: "notes", type: "textarea", label: "Notes", maxLength: 40 },
];

describe("storage identifiers", () => {
  it("accepts safe keys and collections", () => {
    expect(assertStorageKey("state/servers.json")).toBe("state/servers.json");
    expect(assertStorageCollection("state")).toBe("state");
  });

  it("rejects traversal, empty segments, and prototype keys", () => {
    expect(() => assertStorageKey("../etc/passwd")).toThrow(
      ForgeValidationError,
    );
    expect(() => assertStorageKey("foo/../bar")).toThrow(ForgeValidationError);
    expect(() => assertStorageKey("foo//bar")).toThrow(ForgeValidationError);
    expect(() => assertStorageKey("__proto__")).toThrow(ForgeValidationError);
    expect(() => assertStorageKey("constructor")).toThrow(ForgeValidationError);
    expect(() => assertStorageKey("foo/prototype/bar")).toThrow(
      ForgeValidationError,
    );
    expect(() => assertStorageCollection("..")).toThrow(ForgeValidationError);
  });

  it("rejects names that cannot be SQL identifiers or paths", () => {
    expect(() => assertStorageKey("users;drop")).toThrow(ForgeValidationError);
    expect(() => assertStorageKey('"users"')).toThrow(ForgeValidationError);
    expect(() => assertStorageKey("")).toThrow(ForgeValidationError);
    expect(() => assertStorageKey("/abs")).toThrow(ForgeValidationError);
  });
});

describe("validatePluginConfig", () => {
  it("applies defaults and validates types, required fields, and select options", () => {
    const result = validatePluginConfig(configSchema, {
      host: "smtp.example.com",
      api_token: "tok_live",
      region: "eu",
      flags: ["a"],
      webhook: "https://example.com/hook",
      contact: "ops@example.com",
    });
    expect(result.values).toEqual({
      host: "smtp.example.com",
      port: 25,
      secure: false,
      region: "eu",
      flags: ["a"],
      webhook: "https://example.com/hook",
      contact: "ops@example.com",
    });
    expect(result.secrets).toEqual({ api_token: "tok_live" });
    expect(result.values).not.toHaveProperty("api_token");
  });

  it("rejects missing required fields and invalid types", () => {
    expect(() => validatePluginConfig(configSchema, { port: 25 })).toThrow(
      ForgeConfigError,
    );
    expect(() =>
      validatePluginConfig(configSchema, { host: 1, api_token: "x" }),
    ).toThrow(ForgeConfigError);
    expect(() =>
      validatePluginConfig(configSchema, {
        host: "h",
        api_token: "x",
        port: "25",
      }),
    ).toThrow(ForgeConfigError);
    expect(() =>
      validatePluginConfig(configSchema, {
        host: "h",
        api_token: "x",
        region: "ap",
      }),
    ).toThrow(ForgeConfigError);
    expect(() =>
      validatePluginConfig(configSchema, {
        host: "h",
        api_token: "x",
        flags: ["z"],
      }),
    ).toThrow(ForgeConfigError);
    expect(() =>
      validatePluginConfig(configSchema, {
        host: "h",
        api_token: "x",
        webhook: "not-a-url",
      }),
    ).toThrow(ForgeConfigError);
    expect(() =>
      validatePluginConfig(configSchema, {
        host: "h",
        api_token: "x",
        contact: "not-an-email",
      }),
    ).toThrow(ForgeConfigError);
  });

  it("rejects prototype keys and unknown keys", () => {
    expect(() =>
      validatePluginConfig(
        configSchema,
        JSON.parse('{"host":"h","api_token":"x","__proto__":{"a":1}}'),
      ),
    ).toThrow();
    expect(() =>
      validatePluginConfig(configSchema, {
        host: "h",
        api_token: "x",
        constructor: "nope",
      }),
    ).toThrow();
    expect(() =>
      validatePluginConfig(configSchema, {
        host: "h",
        api_token: "x",
        extra: true,
      }),
    ).toThrow(ForgeConfigError);
  });
});

describe("admin DTO helpers", () => {
  it("never includes secret values", () => {
    const secret = "super-secret-token";
    const publicView = toPluginConfigPublic(
      { host: "smtp.example.com", api_token: secret },
      ["api_token"],
    );
    expect(publicView.values).toEqual({ host: "smtp.example.com" });
    expect(publicView.secretKeysSet).toEqual(["api_token"]);
    expect(JSON.stringify(publicView)).not.toContain(secret);

    const instanceView = toPluginInstanceRecord(
      {
        id: "11111111-1111-4111-8111-111111111111",
        pluginId: "acme.mail",
        kind: "service",
        displayName: "Primary",
        enabled: true,
        config: { host: "smtp.example.com", api_token: secret },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      ["api_token"],
    );
    expect(instanceView.config.values).toEqual({ host: "smtp.example.com" });
    expect(instanceView.config.secretKeysSet).toEqual(["api_token"]);
    expect(JSON.stringify(instanceView)).not.toContain(secret);
  });
});

describe("memory plugin persist", () => {
  it("isolates storage namespaces between plugins", async () => {
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    await persist.upsertInstall({
      id: "acme.dns",
      type: "service",
      version: "1.0.0",
      manifest: dnsManifest,
    });
    await persist.setKv("acme.mail", "state/item", { ok: true });
    await persist.setKv("acme.dns", "state/item", { ok: false });

    expect(await persist.getKv("acme.mail", "state/item")).toEqual({
      ok: true,
    });
    expect(await persist.getKv("acme.dns", "state/item")).toEqual({
      ok: false,
    });
    expect(await persist.listKvKeys("acme.mail")).toEqual(["state/item"]);

    const mailStorage = createPluginStorage(persist, "acme.mail");
    const dnsStorage = createPluginStorage(persist, "acme.dns");
    expect(await mailStorage.get("state/item")).toEqual({ ok: true });
    expect(await dnsStorage.get("state/item")).toEqual({ ok: false });
    expect(await mailStorage.keys("state/")).toEqual(["state/item"]);
    expect("forPlugin" in mailStorage).toBe(false);
  });

  it("rejects unsafe kv keys on the persist API", async () => {
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    await expect(persist.setKv("acme.mail", "../x", 1)).rejects.toBeInstanceOf(
      ForgeValidationError,
    );
    await expect(
      persist.getKv("acme.mail", "foo/../bar"),
    ).rejects.toBeInstanceOf(ForgeValidationError);
  });

  it("round-trips sealed secrets and omits values from instance DTOs", async () => {
    const appKey = generateKey();
    const persist = createMemoryPluginPersist({ appKey });
    const secret = "smtp-password";
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    const instance = await persist.createInstance({
      pluginId: "acme.mail",
      kind: "service",
      displayName: "Primary",
      config: { host: "smtp.example.com" },
    });
    await persist.setSecret("acme.mail", "api_token", secret, instance.id);
    expect(await persist.getSecret("acme.mail", "api_token", instance.id)).toBe(
      secret,
    );
    const keysSet = await persist.listSecretKeysSet("acme.mail", instance.id);
    const dto = toPluginInstanceRecord(instance, keysSet);
    expect(dto.config.secretKeysSet).toEqual(["api_token"]);
    expect(JSON.stringify(dto)).not.toContain(secret);
    expect(JSON.stringify(instance)).not.toContain(secret);
  });

  it("stores plaintext secrets when APP_KEY is empty", async () => {
    const persist = createMemoryPluginPersist({ appKey: "" });
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    await persist.setSecret("acme.mail", "api_token", "dev-secret");
    expect(await persist.getSecret("acme.mail", "api_token")).toBe(
      "dev-secret",
    );
  });

  it("retains kv after uninstall until explicit purge", async () => {
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    await persist.setKv("acme.mail", "kept", "yes");
    await persist.setSecret("acme.mail", "api_token", "hidden");
    await persist.uninstall("acme.mail");
    expect(await persist.getInstall("acme.mail")).toBeUndefined();
    expect(await persist.getKv("acme.mail", "kept")).toBe("yes");
    expect(await persist.getSecret("acme.mail", "api_token")).toBe("hidden");

    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    await persist.uninstall("acme.mail", { purgeStorage: true });
    expect(await persist.getKv("acme.mail", "kept")).toBeUndefined();
    expect(await persist.getSecret("acme.mail", "api_token")).toBeNull();
  });

  it("blocks disable and uninstall when instance dependents exist", async () => {
    const persist = createMemoryPluginPersist();
    await persist.upsertInstall({
      id: "acme.mail",
      type: "service",
      version: "1.0.0",
      manifest: mailManifest,
    });
    const instance = await persist.createInstance({
      pluginId: "acme.mail",
      kind: "service",
      displayName: "Primary",
      enabled: true,
    });
    await expect(
      persist.assertCanUninstall("acme.mail"),
    ).rejects.toBeInstanceOf(ForgeConflictError);
    await expect(persist.uninstall("acme.mail")).rejects.toBeInstanceOf(
      ForgeConflictError,
    );
    await expect(persist.assertCanDisable("acme.mail")).rejects.toBeInstanceOf(
      ForgeConflictError,
    );
    await expect(persist.setEnabled("acme.mail", false)).rejects.toBeInstanceOf(
      ForgeConflictError,
    );
    expect(await persist.getInstall("acme.mail")).toBeDefined();
    expect(await persist.getKv("acme.mail", "kept")).toBeUndefined();

    await persist.setInstanceEnabled(instance.id, false);
    await persist.assertCanDisable("acme.mail");
    await persist.setEnabled("acme.mail", false);
    await expect(persist.uninstall("acme.mail")).rejects.toBeInstanceOf(
      ForgeConflictError,
    );

    await persist.deleteInstance(instance.id);
    await persist.uninstall("acme.mail");
    expect(await persist.getInstall("acme.mail")).toBeUndefined();
  });
});

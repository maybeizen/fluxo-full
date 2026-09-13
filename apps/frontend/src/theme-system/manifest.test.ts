import { describe, expect, it } from "vitest";
import { themeManifestSchema } from "./manifest";

describe("themeManifestSchema", () => {
  it("accepts a valid required-only manifest", () => {
    const result = themeManifestSchema.safeParse({
      id: "default",
      name: "Default",
      version: "1.0.0",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        id: "default",
        name: "Default",
        version: "1.0.0",
      });
    }
  });

  it("accepts optional fields", () => {
    const result = themeManifestSchema.safeParse({
      id: "example",
      name: "Example",
      version: "1.0.0",
      description: "Example theme",
      author: "Fluxo",
      extends: "default",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extends).toBe("default");
      expect(result.data.author).toBe("Fluxo");
    }
  });

  it("rejects missing required fields", () => {
    expect(themeManifestSchema.safeParse({ id: "bad" }).success).toBe(false);
    expect(
      themeManifestSchema.safeParse({
        name: "Missing id",
        version: "1.0.0",
      }).success,
    ).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(
      themeManifestSchema.safeParse({
        id: "",
        name: "Default",
        version: "1.0.0",
      }).success,
    ).toBe(false);
    expect(
      themeManifestSchema.safeParse({
        id: "default",
        name: "Default",
        version: "1.0.0",
        extends: "",
      }).success,
    ).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { parseThemeId, themeCatalog } from "./catalog";

describe("parseThemeId", () => {
  it("returns default when the value is missing", () => {
    expect(parseThemeId(undefined)).toBe("default");
    expect(parseThemeId("")).toBe("default");
  });

  it("returns catalog ids unchanged", () => {
    expect(parseThemeId("default")).toBe("default");
    expect(parseThemeId("example")).toBe("example");
  });

  it("returns default for unknown ids", () => {
    expect(parseThemeId("unknown")).toBe("default");
    expect(parseThemeId("__proto__")).toBe("default");
  });

  it("uses an injected catalog when provided", () => {
    const catalog = { default: true, custom: true };
    expect(parseThemeId("custom", catalog)).toBe("custom");
    expect(parseThemeId("example", catalog)).toBe("default");
  });

  it("only allows statically registered production themes", () => {
    expect(Object.keys(themeCatalog).sort()).toEqual(["default", "example"]);
  });
});

import { describe, expect, it } from "vitest";
import { LogLevel, PluginStatus } from "./index.js";

describe("types", () => {
  it("exposes log levels", () => {
    expect(LogLevel.Debug).toBe("debug");
    expect(LogLevel.Info).toBe("info");
    expect(LogLevel.Warn).toBe("warn");
    expect(LogLevel.Error).toBe("error");
  });

  it("exposes plugin statuses", () => {
    expect(PluginStatus.Loaded).toBe("loaded");
    expect(PluginStatus.Enabled).toBe("enabled");
    expect(PluginStatus.Disabled).toBe("disabled");
    expect(PluginStatus.Error).toBe("error");
  });
});

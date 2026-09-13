import type { FluxoLogger } from "@fluxo/logger";
import { describe, expect, it, vi } from "vitest";
import { definePlugin } from "./index.js";
import type { FluxoPlugin, PluginContext } from "./index.js";

function mockLogger(): FluxoLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(),
  };
}

describe("definePlugin", () => {
  it("returns the same plugin contract", () => {
    const plugin: FluxoPlugin = {
      manifest: { id: "demo", name: "Demo", version: "1.0.0" },
    };
    expect(definePlugin(plugin)).toBe(plugin);
  });

  it("preserves optional lifecycle hooks", async () => {
    const onLoad = vi.fn();
    const plugin = definePlugin({
      manifest: { id: "demo", name: "Demo", version: "1.0.0", description: "test" },
      onLoad,
    });
    const ctx: PluginContext = { logger: mockLogger(), config: { flag: true } };
    await plugin.onLoad?.(ctx);
    expect(onLoad).toHaveBeenCalledWith(ctx);
  });
});

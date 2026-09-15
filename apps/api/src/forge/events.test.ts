import { ForgePermissionError, type PluginLogger } from "@fluxo/forge";
import { describe, expect, it } from "vitest";
import { createForgeEventBus, createPluginEvents, emitForgeEvent, setActiveForgeEventBus } from "./events.js";

function silentLogger(): PluginLogger {
  const logger: PluginLogger = {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return logger;
    },
  };
  return logger;
}

describe("forge events", () => {
  it("isolates listener throws so emit still notifies others", async () => {
    const bus = createForgeEventBus(silentLogger());
    const seen: string[] = [];
    bus.on("user.created", () => {
      throw new Error("listener boom");
    });
    bus.on("user.created", () => {
      seen.push("second");
    });
    await expect(bus.emit("user.created", { userId: "u1" })).resolves.toBeUndefined();
    expect(seen).toEqual(["second"]);
  });

  it("denies subscribe and emit without permissions", async () => {
    const bus = createForgeEventBus();
    const events = createPluginEvents({
      pluginId: "acme.demo",
      permissions: [],
      bus,
    });
    expect(() => events.on("user.created", () => undefined)).toThrow(ForgePermissionError);
    expect(() => events.onCustom("tick", () => undefined)).toThrow(ForgePermissionError);
    await expect(events.emitCustom("tick", { ok: true })).rejects.toBeInstanceOf(
      ForgePermissionError,
    );
  });

  it("qualifies custom events and does not emit core names", async () => {
    const bus = createForgeEventBus();
    const events = createPluginEvents({
      pluginId: "acme.demo",
      permissions: ["events.subscribe", "events.emit"],
      bus,
    });
    const payloads: unknown[] = [];
    events.onCustom("tick", (payload) => {
      payloads.push(payload);
    });
    await events.emitCustom("tick", { n: 1 });
    expect(payloads).toEqual([{ n: 1 }]);
  });

  it("routes host emitForgeEvent through the active bus", async () => {
    const bus = createForgeEventBus();
    const seen: string[] = [];
    bus.on("settings.updated", (payload) => {
      seen.push(...payload.keys);
    });
    setActiveForgeEventBus(bus);
    await emitForgeEvent("settings.updated", { keys: ["appName"] });
    expect(seen).toEqual(["appName"]);
    setActiveForgeEventBus(undefined);
    await emitForgeEvent("settings.updated", { keys: ["ignored"] });
    expect(seen).toEqual(["appName"]);
  });
});

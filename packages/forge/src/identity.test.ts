import { describe, expect, it } from "vitest";
import {
  forgeApiSatisfied,
  FORGE_API_VERSION,
  isPluginId,
  parsePluginId,
  ForgeValidationError,
  forgeWebhookPath,
  isSafeWebhookName,
  qualifyEventName,
  qualifyJobName,
} from "./index.js";

describe("plugin identity", () => {
  it("accepts dotted slugs", () => {
    expect(isPluginId("demo")).toBe(true);
    expect(isPluginId("acme.pterodactyl")).toBe(true);
    expect(isPluginId("acme.game-panel.nodes")).toBe(true);
  });

  it("rejects traversal and uppercase", () => {
    expect(isPluginId("../etc")).toBe(false);
    expect(isPluginId("Acme")).toBe(false);
    expect(isPluginId("foo/bar")).toBe(false);
    expect(isPluginId("__proto__")).toBe(false);
    expect(() => parsePluginId("..")).toThrow(ForgeValidationError);
  });
});

describe("forgeApiSatisfied", () => {
  it("matches caret ranges on 0.x", () => {
    expect(forgeApiSatisfied("^0.1.0", "0.1.0")).toBe(true);
    expect(forgeApiSatisfied("^0.1.0", "0.1.9")).toBe(true);
    expect(forgeApiSatisfied("^0.1.0", "0.2.0")).toBe(false);
    expect(forgeApiSatisfied("^0.1.0", FORGE_API_VERSION)).toBe(true);
  });

  it("matches exact and tilde", () => {
    expect(forgeApiSatisfied("0.1.0", "0.1.0")).toBe(true);
    expect(forgeApiSatisfied("0.1.0", "0.1.1")).toBe(false);
    expect(forgeApiSatisfied("~0.1.0", "0.1.5")).toBe(true);
    expect(forgeApiSatisfied("~0.1.0", "0.2.0")).toBe(false);
  });
});

describe("qualification helpers", () => {
  it("namespaces jobs, events, and webhooks", () => {
    expect(qualifyJobName("acme.pay", "sync")).toBe("acme.pay:sync");
    expect(qualifyEventName("acme.pay", "settled")).toBe(
      "plugin.acme.pay.settled",
    );
    expect(isSafeWebhookName("stripe_in")).toBe(true);
    expect(
      forgeWebhookPath(
        "acme.pay",
        "00000000-0000-4000-8000-000000000001",
        "stripe_in",
      ),
    ).toBe(
      "/forge/webhooks/acme.pay/00000000-0000-4000-8000-000000000001/stripe_in",
    );
  });
});

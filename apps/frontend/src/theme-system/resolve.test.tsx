import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultComponents } from "@/registry/defaults";
import { resolveTheme } from "./resolve";
import type { ThemeModule } from "./types";

function ParentButton() {
  return <button type="button">parent</button>;
}

function ChildButton() {
  return <button type="button">child</button>;
}

function ParentCard() {
  return <div>parent-card</div>;
}

function defaultModule(overrides: Partial<ThemeModule> = {}): ThemeModule {
  return {
    manifest: {
      id: "default",
      name: "Default",
      version: "1.0.0",
    },
    components: { Button: ParentButton, Card: ParentCard },
    translations: { hello: "Hello", bye: "Bye" },
    ...overrides,
  };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveTheme", () => {
  it("loads the default theme from injected modules", async () => {
    const resolved = await resolveTheme("default", {
      modules: { default: defaultModule() },
    });

    expect(resolved.manifest.id).toBe("default");
    expect(resolved.components.Button).toBe(ParentButton);
    expect(resolved.translations.hello).toBe("Hello");
  });

  it("falls back to default for an unknown id", async () => {
    const resolved = await resolveTheme("missing", {
      modules: { default: defaultModule() },
    });

    expect(resolved.manifest.id).toBe("default");
    expect(resolved.components.Button).toBe(ParentButton);
    expect(console.warn).toHaveBeenCalled();
  });

  it("merges child overrides over the parent", async () => {
    const resolved = await resolveTheme("child", {
      modules: {
        default: defaultModule(),
        child: {
          manifest: {
            id: "child",
            name: "Child",
            version: "1.0.0",
            extends: "default",
          },
          components: { Button: ChildButton },
          translations: { hello: "Hi" },
        },
      },
    });

    expect(resolved.manifest.id).toBe("child");
    expect(resolved.components.Button).toBe(ChildButton);
    expect(resolved.components.Card).toBe(ParentCard);
    expect(resolved.translations.hello).toBe("Hi");
    expect(resolved.translations.bye).toBe("Bye");
  });

  it("falls back to default when extends is unknown", async () => {
    const resolved = await resolveTheme("child", {
      modules: {
        default: defaultModule(),
        child: {
          manifest: {
            id: "child",
            name: "Child",
            version: "1.0.0",
            extends: "ghost",
          },
        },
      },
    });

    expect(resolved.manifest.id).toBe("default");
    expect(resolved.components.Button).toBe(ParentButton);
    expect(console.warn).toHaveBeenCalled();
  });

  it("falls back to default when inheritance cycles", async () => {
    const resolved = await resolveTheme("alpha", {
      modules: {
        default: defaultModule(),
        alpha: {
          manifest: {
            id: "alpha",
            name: "Alpha",
            version: "1.0.0",
            extends: "beta",
          },
        },
        beta: {
          manifest: {
            id: "beta",
            name: "Beta",
            version: "1.0.0",
            extends: "alpha",
          },
        },
      },
    });

    expect(resolved.manifest.id).toBe("default");
    expect(resolved.components.Button).toBe(ParentButton);
    expect(console.warn).toHaveBeenCalled();
  });

  it("falls back to default when a theme extends itself", async () => {
    const resolved = await resolveTheme("loop", {
      modules: {
        default: defaultModule(),
        loop: {
          manifest: {
            id: "loop",
            name: "Loop",
            version: "1.0.0",
            extends: "loop",
          },
        },
      },
    });

    expect(resolved.manifest.id).toBe("default");
    expect(console.warn).toHaveBeenCalled();
  });

  it("falls back to default when a theme import fails", async () => {
    const resolved = await resolveTheme("broken", {
      catalog: {
        default: async () => defaultModule(),
        broken: async () => {
          throw new Error("import failed");
        },
      },
    });

    expect(resolved.manifest.id).toBe("default");
    expect(resolved.components.Button).toBe(ParentButton);
    expect(console.warn).toHaveBeenCalled();
  });

  it("falls back to default when the manifest is invalid", async () => {
    const resolved = await resolveTheme("bad", {
      modules: {
        default: defaultModule(),
        bad: {
          manifest: { id: "bad" },
        } as ThemeModule,
      },
    });

    expect(resolved.manifest.id).toBe("default");
    expect(console.warn).toHaveBeenCalled();
  });

  it("does not apply a broken theme onto the registry defaults", async () => {
    const resolved = await resolveTheme("broken", {
      catalog: {
        default: async () => defaultModule(),
        broken: async () => {
          throw new Error("import failed");
        },
      },
    });

    expect(resolved.components.Input).toBe(defaultComponents.Input);
    expect(resolved.components.Button).toBe(ParentButton);
  });

  it("resolves the shipped example theme over default", async () => {
    const resolved = await resolveTheme("example");

    expect(resolved.manifest.id).toBe("example");
    expect(resolved.manifest.extends).toBe("default");
    expect(resolved.components.Button).toBe(defaultComponents.Button);
  });

  it("uses registry defaults when the default theme itself fails", async () => {
    const resolved = await resolveTheme("default", {
      catalog: {
        default: async () => {
          throw new Error("default import failed");
        },
      },
    });

    expect(resolved.manifest.id).toBe("default");
    expect(resolved.components.Button).toBe(defaultComponents.Button);
    expect(resolved.translations).toEqual({});
  });
});

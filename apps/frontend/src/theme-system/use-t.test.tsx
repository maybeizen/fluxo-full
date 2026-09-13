import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { bindTranslations, t, useT } from "./use-t";

afterEach(() => {
  cleanup();
  bindTranslations({}, {});
});

function TranslationProbe({ name }: { name?: string }) {
  const translate = useT();
  return <span>{translate("hello", name ? { name } : undefined)}</span>;
}

describe("t", () => {
  it("reads the active theme translation first", () => {
    bindTranslations({ hello: "Hi {name}" }, { hello: "Hello {name}", unused: "Nope" });
    expect(t("hello", { name: "Ada" })).toBe("Hi Ada");
  });

  it("falls back to default translations", () => {
    bindTranslations({}, { welcome: "Welcome {name}" });
    expect(t("welcome", { name: "Ada" })).toBe("Welcome Ada");
  });

  it("falls back to the key when nothing matches", () => {
    bindTranslations({ other: "Other" }, { else: "Else" });
    expect(t("missing.key")).toBe("missing.key");
  });

  it("leaves unknown interpolation tokens in place", () => {
    bindTranslations({ hello: "Hi {name}" });
    expect(t("hello")).toBe("Hi {name}");
    expect(t("hello", { other: "x" })).toBe("Hi {name}");
  });
});

describe("useT", () => {
  it("reads from the same store as t", () => {
    bindTranslations({ hello: "Hi {name}" }, { hello: "Hello {name}" });
    render(<TranslationProbe name="Ada" />);
    expect(screen.getByText("Hi Ada")).toBeInTheDocument();
    expect(t("hello", { name: "Ada" })).toBe("Hi Ada");
  });

  it("re-renders when translations change", () => {
    bindTranslations({ hello: "Hi" });
    render(<TranslationProbe />);
    expect(screen.getByText("Hi")).toBeInTheDocument();

    act(() => {
      bindTranslations({ hello: "Hey" });
    });
    expect(screen.getByText("Hey")).toBeInTheDocument();
    expect(t("hello")).toBe("Hey");
  });
});

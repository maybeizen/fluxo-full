import { describe, expect, it } from "vitest";
import type { PluginConfigField } from "@fluxo/forge";
import { validatePluginConfigDraft } from "./validate-config";

const schema: PluginConfigField[] = [
  { key: "host", type: "text", label: "Host", required: true, minLength: 1 },
  { key: "port", type: "number", label: "Port", integer: true, min: 1, max: 65535 },
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
];

describe("validatePluginConfigDraft", () => {
  it("accepts required secrets that are already set when the draft is blank", () => {
    const errors = validatePluginConfigDraft(
      schema,
      { host: "smtp.example.com", port: 25, region: "us" },
      { api_token: { value: "", clear: false } },
      ["api_token"],
    );
    expect(errors).toEqual([]);
  });

  it("rejects required secrets that are not set", () => {
    const errors = validatePluginConfigDraft(
      schema,
      { host: "smtp.example.com", port: 25 },
      { api_token: { value: "", clear: false } },
      [],
    );
    expect(errors).toEqual([{ key: "api_token", label: "API token", code: "required" }]);
  });

  it("checks number min/max without executing schema regex", () => {
    const errors = validatePluginConfigDraft(
      schema,
      { host: "smtp.example.com", port: 70000 },
      { api_token: { value: "x", clear: false } },
      [],
    );
    expect(errors).toEqual([{ key: "port", label: "Port", code: "max" }]);
  });
});

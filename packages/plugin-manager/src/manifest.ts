import type { PluginManifest } from "@fluxo/types";
import { z } from "zod";

export const pluginManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
});

export function formatManifestError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "manifest";
      return `${path}: ${issue.message}`;
    })
    .join("; ");
}

export function fallbackManifest(id: string, raw: unknown): PluginManifest {
  if (typeof raw !== "object" || raw === null) {
    return { id, name: id, version: "0.0.0" };
  }

  const name = "name" in raw && typeof raw.name === "string" && raw.name.length > 0 ? raw.name : id;
  const version =
    "version" in raw && typeof raw.version === "string" && raw.version.length > 0 ? raw.version : "0.0.0";
  const description =
    "description" in raw && typeof raw.description === "string" ? raw.description : undefined;

  return {
    id,
    name,
    version,
    ...(description ? { description } : {}),
  };
}

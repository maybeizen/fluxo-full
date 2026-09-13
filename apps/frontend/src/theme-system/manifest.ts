import { z } from "zod";

export const themeManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  extends: z.string().min(1).optional(),
});

export type ThemeManifest = z.infer<typeof themeManifestSchema>;

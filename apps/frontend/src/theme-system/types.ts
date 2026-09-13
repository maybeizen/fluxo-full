import type { UIComponents } from "@/registry/types";
import type { ThemeManifest } from "./manifest";

export interface ThemeModule {
  manifest: ThemeManifest;
  components?: Partial<UIComponents>;
  translations?: Record<string, string>;
}

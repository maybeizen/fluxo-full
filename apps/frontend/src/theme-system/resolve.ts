import { defaultComponents } from "@/registry/defaults";
import type { UIComponents } from "@/registry/types";
import { parseThemeId, themeCatalog, type ResolvableCatalog, type ThemeLoader } from "./catalog";
import { themeManifestSchema, type ThemeManifest } from "./manifest";
import type { ThemeModule } from "./types";

export interface ResolvedTheme {
  manifest: ThemeManifest;
  components: UIComponents;
  translations: Record<string, string>;
}

export interface ResolveThemeOptions {
  catalog?: ResolvableCatalog;
  modules?: Record<string, ThemeModule>;
}

const emergencyManifest: ThemeManifest = {
  id: "default",
  name: "Default",
  version: "1.0.0",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isThemeModule(value: unknown): value is ThemeModule {
  return isRecord(value) && isRecord(value.manifest);
}

function unwrapThemeModule(imported: unknown): ThemeModule {
  if (isThemeModule(imported)) {
    return imported;
  }

  if (isRecord(imported) && isThemeModule(imported.default)) {
    return imported.default;
  }

  throw new Error("Theme module is missing a valid export");
}

function completeComponents(partial?: Partial<UIComponents>): UIComponents {
  return {
    ...defaultComponents,
    ...partial,
  };
}

function toResolved(mod: ThemeModule): ResolvedTheme {
  return {
    manifest: mod.manifest,
    components: completeComponents(mod.components),
    translations: { ...(mod.translations ?? {}) },
  };
}

function emergencyDefault(): ResolvedTheme {
  return {
    manifest: emergencyManifest,
    components: completeComponents(),
    translations: {},
  };
}

function modulesToCatalog(modules: Record<string, ThemeModule>): ResolvableCatalog {
  const catalog: Record<string, ThemeLoader> = {};

  for (const [id, mod] of Object.entries(modules)) {
    catalog[id] = () => Promise.resolve(mod);
  }

  if (!catalog.default) {
    catalog.default = async () => {
      throw new Error("Default theme module is not registered");
    };
  }

  return catalog as ResolvableCatalog;
}

function resolveCatalog(options: ResolveThemeOptions): ResolvableCatalog {
  if (options.modules) {
    return modulesToCatalog(options.modules);
  }

  return options.catalog ?? themeCatalog;
}

function warnFallback(reason: string, error?: unknown): void {
  if (error === undefined) {
    console.warn(`[theme-system] ${reason}; falling back to default`);
    return;
  }

  console.warn(`[theme-system] ${reason}; falling back to default`, error);
}

async function loadValidated(loader: ThemeLoader): Promise<ThemeModule> {
  const imported = await loader();
  const mod = unwrapThemeModule(imported);
  const parsed = themeManifestSchema.safeParse(mod.manifest);

  if (!parsed.success) {
    throw new Error("Invalid theme manifest");
  }

  return {
    manifest: parsed.data,
    components: mod.components,
    translations: mod.translations,
  };
}

async function loadDefaultTheme(catalog: ResolvableCatalog): Promise<ResolvedTheme> {
  const loader = catalog.default;

  try {
    return toResolved(await loadValidated(loader));
  } catch (error) {
    warnFallback("Failed to load the default theme", error);
    return emergencyDefault();
  }
}

async function resolveRegisteredTheme(
  id: string,
  catalog: ResolvableCatalog,
): Promise<ResolvedTheme> {
  const visiting = new Set<string>([id]);
  const loader = catalog[id];

  if (!loader) {
    throw new Error(`Unknown theme "${id}"`);
  }

  const child = await loadValidated(loader);
  const parentId = child.manifest.extends;

  if (!parentId) {
    return toResolved(child);
  }

  if (parentId === id || visiting.has(parentId)) {
    throw new Error(`Cyclic theme inheritance "${id}" -> "${parentId}"`);
  }

  if (!Object.hasOwn(catalog, parentId)) {
    throw new Error(`Unknown parent theme "${parentId}"`);
  }

  const parentLoader = catalog[parentId];

  if (!parentLoader) {
    throw new Error(`Unknown parent theme "${parentId}"`);
  }

  const parent = await loadValidated(parentLoader);
  const parentExtends = parent.manifest.extends;

  if (parentExtends && (parentExtends === id || visiting.has(parentExtends))) {
    throw new Error(`Cyclic theme inheritance "${id}" -> "${parentId}" -> "${parentExtends}"`);
  }

  return {
    manifest: child.manifest,
    components: completeComponents({
      ...parent.components,
      ...child.components,
    }),
    translations: {
      ...(parent.translations ?? {}),
      ...(child.translations ?? {}),
    },
  };
}

export async function resolveTheme(
  themeId?: string,
  options: ResolveThemeOptions = {},
): Promise<ResolvedTheme> {
  const catalog = resolveCatalog(options);
  const fallback = await loadDefaultTheme(catalog);

  if (typeof themeId === "string" && themeId.length > 0 && !Object.hasOwn(catalog, themeId)) {
    warnFallback(`Unknown theme "${themeId}"`);
    return fallback;
  }

  const id = parseThemeId(themeId, catalog);

  if (id === "default") {
    return fallback;
  }

  try {
    return await resolveRegisteredTheme(id, catalog);
  } catch (error) {
    warnFallback(`Failed to resolve theme "${id}"`, error);
    return fallback;
  }
}

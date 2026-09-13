export const themeCatalog = {
  default: () => import("@/themes/default"),
  example: () => import("@/themes/example"),
} as const;

export type ThemeId = keyof typeof themeCatalog;

export type ThemeLoader = () => Promise<unknown>;

export type ResolvableCatalog = {
  default: ThemeLoader;
} & Record<string, ThemeLoader>;

export function parseThemeId(
  value: string | undefined,
  catalog: Record<string, unknown> = themeCatalog,
): string {
  if (typeof value === "string" && value.length > 0 && Object.hasOwn(catalog, value)) {
    return value;
  }
  return "default";
}

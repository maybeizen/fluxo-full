import { useEffect, useMemo, useState, type ReactNode } from "react";
import { defaultComponents } from "@/registry/defaults";
import type { UIOverrides } from "@/registry/types";
import defaultTheme from "@/themes/default";
import { parseThemeId } from "./catalog";
import { resolveTheme, type ResolvedTheme } from "./resolve";
import { bindTranslations } from "./use-t";
import { ThemeContext } from "./use-ui";

export interface ThemeProviderProps {
  children: ReactNode;
  themeId?: string;
  components?: UIOverrides;
}

function readEnvThemeId(): string | undefined {
  const value = import.meta.env.VITE_PUBLIC_THEME;
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  return value;
}

function fromDefaultModule(): ResolvedTheme {
  return {
    manifest: defaultTheme.manifest,
    components: {
      ...defaultComponents,
      ...defaultTheme.components,
    },
    translations: { ...(defaultTheme.translations ?? {}) },
  };
}

function commitTheme(next: ResolvedTheme): ResolvedTheme {
  bindTranslations(next.translations, defaultTheme.translations ?? {});
  return next;
}

export function ThemeProvider({ children, themeId, components }: ThemeProviderProps) {
  const requestedId = themeId ?? readEnvThemeId();
  const parsedId = parseThemeId(requestedId);
  const [resolved, setResolved] = useState<ResolvedTheme | null>(() =>
    parsedId === "default" ? commitTheme(fromDefaultModule()) : null,
  );

  useEffect(() => {
    const id = parseThemeId(requestedId);

    if (id === "default") {
      const next = fromDefaultModule();
      setResolved((current) => (current?.manifest.id === "default" ? current : commitTheme(next)));
      return;
    }

    let cancelled = false;

    void resolveTheme(requestedId).then((next) => {
      if (!cancelled) {
        setResolved(commitTheme(next));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [requestedId]);

  const value = useMemo(() => {
    if (!resolved) {
      return null;
    }

    return {
      ...resolved.components,
      ...components,
    };
  }, [resolved, components]);

  if (!value) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

import { useCallback, useSyncExternalStore } from "react";
import defaultTranslations from "@/themes/default/translations/en.json";

type TranslationTable = Record<string, string>;

interface TranslationSnapshot {
  active: TranslationTable;
  fallback: TranslationTable;
}

const listeners = new Set<() => void>();

let snapshot: TranslationSnapshot = {
  active: defaultTranslations,
  fallback: defaultTranslations,
};

function tablesEqual(left: TranslationTable, right: TranslationTable): boolean {
  if (left === right) {
    return true;
  }

  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);

  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  return leftKeys.every((key) => left[key] === right[key]);
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function bindTranslations(
  active: TranslationTable,
  fallback: TranslationTable = {},
): void {
  if (tablesEqual(snapshot.active, active) && tablesEqual(snapshot.fallback, fallback)) {
    return;
  }

  snapshot = { active, fallback };
  emit();
}

function interpolate(template: string, vars?: Record<string, string>): string {
  if (!vars) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : value;
  });
}

function translate(
  table: TranslationSnapshot,
  key: string,
  vars?: Record<string, string>,
): string {
  const template = table.active[key] ?? table.fallback[key] ?? key;
  return interpolate(template, vars);
}

export function t(key: string, vars?: Record<string, string>): string {
  return translate(snapshot, key, vars);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TranslationSnapshot {
  return snapshot;
}

export function useT(): (key: string, vars?: Record<string, string>) => string {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useCallback(
    (key: string, vars?: Record<string, string>) => translate(current, key, vars),
    [current],
  );
}

import { createContext, useContext } from "react";
import type { UIComponents } from "@/registry/types";
import { useT } from "./use-t";

export const ThemeContext = createContext<UIComponents | null>(null);

export function useUI(): UIComponents {
  const context = useContext(ThemeContext);
  useT();
  if (!context) {
    throw new Error("useUI must be used within a ThemeProvider");
  }
  return context;
}

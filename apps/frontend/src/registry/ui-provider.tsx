import { createContext, useContext, useMemo, type ReactNode } from "react";
import { defaultComponents } from "./defaults";
import type { UIComponents, UIOverrides } from "./types";

const UIContext = createContext<UIComponents | null>(null);

export interface UIProviderProps {
  children: ReactNode;
  components?: UIOverrides;
}

export function UIProvider({ children, components }: UIProviderProps) {
  const value = useMemo(
    () => ({
      ...defaultComponents,
      ...components,
    }),
    [components],
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIComponents {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}

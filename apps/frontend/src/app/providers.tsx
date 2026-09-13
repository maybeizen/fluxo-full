import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { ThemeProvider, useUI } from "@/theme-system";
import type { UIOverrides } from "@/registry/types";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export interface AppProvidersProps {
  children: ReactNode;
  components?: UIOverrides;
  themeId?: string;
}

export function AppProviders({ children, components, themeId }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <SettingsThemeBridge themeId={themeId} components={components}>
        {children}
      </SettingsThemeBridge>
    </QueryClientProvider>
  );
}

function SettingsThemeBridge({
  children,
  themeId,
  components,
}: {
  children: ReactNode;
  themeId?: string;
  components?: UIOverrides;
}) {
  const settings = usePublicSettings();
  useEffect(() => {
    if (settings.billingLocale.length > 0) {
      document.documentElement.lang = settings.billingLocale;
    }
  }, [settings.billingLocale]);

  return (
    <ThemeProvider themeId={themeId ?? settings.activeThemeId} components={components}>
      <AppChrome>{children}</AppChrome>
    </ThemeProvider>
  );
}

function AppChrome({ children }: { children: ReactNode }) {
  const { TooltipProvider } = useUI();

  return (
    <TooltipProvider>
      {children}
      <Toaster />
    </TooltipProvider>
  );
}

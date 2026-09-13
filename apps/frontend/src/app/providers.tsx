import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { UIProvider, useUI } from "@/registry/ui-provider";
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
}

export function AppProviders({ children, components }: AppProvidersProps) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <UIProvider components={components}>
        <AppChrome>{children}</AppChrome>
      </UIProvider>
    </QueryClientProvider>
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

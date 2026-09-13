import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/layout/brand-mark";
import { t } from "@/theme-system/use-t";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <div className="flex w-full max-w-md flex-col gap-8">
          <div className="flex flex-col items-center gap-3">
            <BrandMark className="font-heading text-xl tracking-tight italic" />
            <div className="h-px w-12 bg-primary" />
          </div>
          {children}
          <Link
            to="/"
            className="text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("auth.backToLanding")}
          </Link>
        </div>
      </div>
    </div>
  );
}

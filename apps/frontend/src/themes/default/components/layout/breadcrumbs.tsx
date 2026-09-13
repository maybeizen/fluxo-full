import { Link } from "@tanstack/react-router";
import { ChevronRightIcon } from "lucide-react";
import type { CrumbItem } from "@/components/layout/app-nav";
import { t } from "@/theme-system/use-t";

export interface BreadcrumbsProps {
  homeTo: "/dashboard" | "/admin";
  items: CrumbItem[];
}

export function Breadcrumbs({ homeTo, items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-2 text-sm">
        <li className="min-w-0">
          <Link
            to={homeTo}
            className="truncate text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("brand.fluxo")}
          </Link>
        </li>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
              <span aria-hidden="true" className="text-muted-foreground">
                <ChevronRightIcon className="size-3.5" />
              </span>
              {item.to && !isLast ? (
                <Link
                  to={item.to}
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span className="truncate font-medium text-foreground">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

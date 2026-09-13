import { Link } from "@tanstack/react-router";
import {
  BookOpenIcon,
  ChevronRightIcon,
  LifeBuoyIcon,
  MessageCircleIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { DashboardProfileLink } from "@/features/dashboard/dashboard-data";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

const linkIcons = {
  docs: BookOpenIcon,
  discord: MessageCircleIcon,
  support: LifeBuoyIcon,
} as const;

export function DashboardLinksCard({ links }: { links: readonly DashboardProfileLink[] }) {
  const { Button } = useUI();
  const t = useT();

  if (links.length === 0) {
    return null;
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <ul className="flex min-h-0 flex-1 flex-col" aria-label={t("dashboard.links.title")}>
        {links.map((link) => {
          const Icon = linkIcons[link.id];
          const label = t(link.labelKey);
          const content = (
            <>
              <span className="flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{label}</span>
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </>
          );
          return (
            <li
              key={link.id}
              className="min-h-0 flex-1 border-b border-border last:border-b-0"
            >
              <LinkButton
                Button={Button}
                href={link.href}
                external={link.external}
              >
                {content}
              </LinkButton>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LinkButton({
  Button,
  href,
  external,
  children,
}: {
  Button: ReturnType<typeof useUI>["Button"];
  href: string;
  external: boolean;
  children: ReactNode;
}) {
  const className =
    "h-full w-full justify-start gap-3 rounded-none border-0 px-4 hover:bg-muted/50";

  if (external) {
    return (
      <Button
        nativeButton={false}
        variant="ghost"
        className={className}
        render={<a href={href} target="_blank" rel="noreferrer" />}
      >
        {children}
      </Button>
    );
  }

  if (href.startsWith("/") && !href.startsWith("/#")) {
    return (
      <Button
        nativeButton={false}
        variant="ghost"
        className={className}
        render={<Link to={href as "/support"} />}
      >
        {children}
      </Button>
    );
  }

  return (
    <Button
      nativeButton={false}
      variant="ghost"
      className={className}
      render={<a href={href} />}
    >
      {children}
    </Button>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowRightIcon, type LucideIcon } from "lucide-react";
import { useUI } from "@/theme-system/use-ui";

export function DashboardEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { to: "/store" | "/support"; label: string };
}) {
  const { Button } = useUI();

  return (
    <div className="flex h-full min-h-48 flex-col items-center justify-center gap-5 px-6 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-foreground/10">
        <Icon className="size-6" />
      </div>
      <div className="flex max-w-sm flex-col gap-1.5">
        <p className="font-heading text-lg font-medium tracking-tight">{title}</p>
        {description ? (
          <p className="text-sm text-muted-foreground text-pretty">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Button nativeButton={false} render={<Link to={action.to} />}>
          {action.label}
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      ) : null}
    </div>
  );
}

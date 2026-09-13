import { Link } from "@tanstack/react-router";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { cn } from "@/lib/cn";

export function BrandMark({
  className,
  to = "/",
}: {
  className?: string;
  to?: "/";
}) {
  const settings = usePublicSettings();
  return (
    <Link to={to} className={cn("inline-flex items-center gap-2", className)}>
      {settings.appIconUrl ? (
        <img
          key={settings.appIconUrl}
          src={settings.appIconUrl}
          alt=""
          className="size-6 rounded-md object-cover"
        />
      ) : null}
      <span>{settings.appName}</span>
    </Link>
  );
}

export function BrandLabel({ className }: { className?: string }) {
  const settings = usePublicSettings();
  const initial = settings.appName.trim().charAt(0).toUpperCase() || "F";

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-3", className)}>
      {settings.appIconUrl ? (
        <img
          key={settings.appIconUrl}
          src={settings.appIconUrl}
          alt=""
          className="size-5 shrink-0 rounded-md object-cover"
        />
      ) : (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 font-heading text-[11px] font-medium text-primary">
          {initial}
        </span>
      )}
      <span className="min-w-0 truncate font-heading text-base font-medium tracking-tight group-data-[collapsible=icon]:hidden">
        {settings.appName}
      </span>
    </span>
  );
}

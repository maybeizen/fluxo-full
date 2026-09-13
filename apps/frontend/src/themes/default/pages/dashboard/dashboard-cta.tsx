import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function DashboardCta({ name, actionTo }: { name: string; actionTo: "/store" }) {
  const { Button } = useUI();
  const t = useT();

  return (
    <section className="relative flex min-h-0 overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_100%_-10%,color-mix(in_oklch,var(--primary)_32%,transparent),transparent_58%)]" />
      <div className="pointer-events-none absolute -left-16 top-10 size-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="landing-grain pointer-events-none absolute inset-0 opacity-45" />
      <div className="relative flex min-h-0 w-full flex-col justify-center gap-3 px-6 py-5 sm:px-8">
        <p className="text-[0.7rem] font-medium tracking-[0.22em] text-primary uppercase">
          {t("dashboard.cta.eyebrow")}
        </p>
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-2xl font-medium tracking-tight text-balance sm:text-3xl">
            {t("dashboard.cta.title", { name })}
          </h2>
          <p className="max-w-lg text-sm text-muted-foreground text-pretty">
            {t("dashboard.cta.body")}
          </p>
        </div>
        <div>
          <Button nativeButton={false} render={<Link to={actionTo} />} size="lg">
            {t("dashboard.cta.action")}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </section>
  );
}

import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function LandingCta() {
  const { Button } = useUI();

  return (
    <section className="px-6 pb-24">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-8 border border-border bg-card px-8 py-14 sm:px-12">
        <div className="flex flex-col gap-4">
          <div className="h-px w-12 bg-primary" />
          <h2 className="font-heading max-w-2xl text-4xl text-balance sm:text-5xl">
            {t("landing.cta.title")}
          </h2>
          <p className="max-w-xl text-muted-foreground text-pretty">{t("landing.cta.body")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            nativeButton={false}
            render={<Link to="/register" />}
            size="lg"
            className="h-10 px-4"
          >
            {t("landing.cta.getStarted")}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
          <Button
            nativeButton={false}
            render={<Link to="/login" />}
            size="lg"
            variant="outline"
            className="h-10 px-4"
          >
            {t("landing.cta.login")}
          </Button>
        </div>
      </div>
    </section>
  );
}

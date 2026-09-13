import { Link } from "@tanstack/react-router";
import { ArrowRightIcon } from "lucide-react";
import { heroLedger } from "@/features/landing/landing-data";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function LandingHero() {
  const {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Separator,
  } = useUI();

  return (
    <section className="relative overflow-hidden px-6 pt-20 pb-24 sm:pt-28">
      <div className="landing-grid pointer-events-none absolute inset-0" />
      <div className="landing-grain pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid w-full max-w-6xl gap-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
        <div className="flex flex-col items-start gap-8">
          <div className="flex flex-col gap-4">
            <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">
              {t("landing.badge")}
            </p>
            <div className="h-px w-12 bg-primary" />
          </div>
          <h1 className="font-heading text-5xl leading-[1.05] text-balance sm:text-6xl">
            {t("landing.hero.title")}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-pretty">
            {t("landing.hero.body")}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              nativeButton={false}
              render={<Link to="/register" />}
              size="lg"
              className="h-10 px-4"
            >
              {t("landing.hero.getStarted")}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              nativeButton={false}
              render={<a href="#plans" />}
              size="lg"
              variant="outline"
              className="h-10 px-4"
            >
              {t("landing.hero.viewPlans")}
            </Button>
          </div>
        </div>
        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-700">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>{t("landing.hero.cycle")}</CardTitle>
              <Badge>{t("landing.hero.closing")}</Badge>
            </div>
            <CardDescription>{t("landing.hero.cycleDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-4">
            {heroLedger.map((row, index) => (
              <div key={row.server} className="flex flex-col gap-4">
                {index > 0 ? <Separator /> : null}
                <div className="flex items-baseline justify-between gap-4">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate font-medium">{row.server}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t("landing.hero.billed", { hours: row.hours })}
                    </p>
                  </div>
                  <p className="font-heading text-xl tabular-nums">{row.amount}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">{t("landing.hero.draftTotal")}</p>
              <p className="font-heading text-2xl tabular-nums">{t("landing.hero.draftAmount")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

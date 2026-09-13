import { Link } from "@tanstack/react-router";
import { CheckIcon } from "lucide-react";
import { getLandingPlans } from "@/features/landing/landing-data";
import { cn } from "@/lib/cn";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";
import { LandingSection, LandingSectionHeading } from "./landing-section";

export function LandingPlans() {
  const {
    Badge,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } = useUI();
  const plans = getLandingPlans();

  return (
    <LandingSection id="plans" className="bg-card/40">
      <LandingSectionHeading
        eyebrow={t("landing.plans.eyebrow")}
        title={t("landing.plans.title")}
        description={t("landing.plans.description")}
      />
      <div className="grid items-stretch gap-4 lg:grid-cols-3 lg:items-center">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={cn(plan.highlighted && "rounded-xl ring-2 ring-primary lg:-translate-y-3")}
          >
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{plan.name}</CardTitle>
                  {plan.highlighted ? <Badge>{t("landing.plans.mostBooked")}</Badge> : null}
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <p className="flex items-baseline gap-1">
                  <span className="font-heading text-5xl tabular-nums">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.cadence}</span>
                </p>
                <ul className="flex flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <CheckIcon className="mt-0.5 size-4 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  nativeButton={false}
                  render={<Link to="/register" />}
                  variant={plan.highlighted ? "default" : "outline"}
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </CardFooter>
            </Card>
          </div>
        ))}
      </div>
    </LandingSection>
  );
}

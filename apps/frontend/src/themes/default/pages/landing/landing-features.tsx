import { getLandingFeatures } from "@/features/landing/landing-data";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";
import { LandingSection, LandingSectionHeading } from "./landing-section";

export function LandingFeatures() {
  const { Card, CardDescription, CardHeader, CardTitle } = useUI();
  const features = getLandingFeatures();

  return (
    <LandingSection id="features">
      <LandingSectionHeading
        eyebrow={t("landing.features.eyebrow")}
        title={t("landing.features.title")}
        description={t("landing.features.description")}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg border bg-muted">
                  <Icon />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </LandingSection>
  );
}

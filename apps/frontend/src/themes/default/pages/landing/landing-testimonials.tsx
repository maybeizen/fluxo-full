import { getLandingTestimonials } from "@/features/landing/landing-data";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";
import { LandingSection, LandingSectionHeading } from "./landing-section";

export function LandingTestimonials() {
  const { Avatar, AvatarFallback, Card, CardContent, CardFooter, CardHeader } = useUI();
  const testimonials = getLandingTestimonials();

  return (
    <LandingSection>
      <LandingSectionHeading
        eyebrow={t("landing.testimonials.eyebrow")}
        title={t("landing.testimonials.title")}
        description={t("landing.testimonials.description")}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {testimonials.map((item) => (
          <Card key={item.name} className="h-full">
            <CardHeader>
              <p className="font-heading text-5xl leading-none text-primary">“</p>
            </CardHeader>
            <CardContent>
              <blockquote className="text-base text-pretty">{item.quote}</blockquote>
            </CardContent>
            <CardFooter className="gap-3">
              <Avatar size="sm">
                <AvatarFallback>{item.initials}</AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-col">
                <cite className="text-sm font-medium not-italic">{item.name}</cite>
                <span className="truncate text-xs text-muted-foreground">{item.role}</span>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </LandingSection>
  );
}

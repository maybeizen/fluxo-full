import { getMarketingAnchors } from "@/components/layout/marketing-links";
import { useAccountMenu } from "@/hooks/use-account-menu";
import { useUI } from "@/theme-system";

export function LandingPage() {
  const {
    MarketingNavbar,
    MarketingFooter,
    LandingHero,
    LandingFeatures,
    LandingPlans,
    LandingTestimonials,
    LandingCta,
  } = useUI();
  const accountMenu = useAccountMenu();
  const items = getMarketingAnchors();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <MarketingNavbar items={items} accountMenu={accountMenu} />
      <main className="flex flex-1 flex-col">
        <LandingHero />
        <LandingFeatures />
        <LandingPlans />
        <LandingTestimonials />
        <LandingCta />
      </main>
      <MarketingFooter items={items} />
    </div>
  );
}

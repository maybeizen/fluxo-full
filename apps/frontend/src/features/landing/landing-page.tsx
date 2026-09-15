import { getMarketingAnchors } from "@/components/layout/marketing-links";
import { useAccountMenu } from "@/hooks/use-account-menu";
import { usePublicSettings } from "@/hooks/use-public-settings";
import {
  PluginSlot,
  toPluginPublicSettings,
  toPluginUserView,
} from "@/plugin-system";
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
  const settings = usePublicSettings();
  const items = getMarketingAnchors();
  const extraItems = accountMenu.user ? (
    <PluginSlot
      point="client.shell.accountMenu"
      slotProps={{
        user: toPluginUserView(accountMenu.user),
        settings: toPluginPublicSettings(settings),
      }}
    />
  ) : undefined;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <MarketingNavbar
        items={items}
        accountMenu={{ ...accountMenu, extraItems }}
      />
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

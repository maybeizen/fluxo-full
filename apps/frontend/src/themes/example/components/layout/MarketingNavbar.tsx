import {
  MarketingNavbar as DefaultMarketingNavbar,
  type MarketingNavbarProps,
} from "@/themes/default/components/layout/marketing-navbar";

export function MarketingNavbar(props: MarketingNavbarProps) {
  return (
    <div data-theme="example">
      <DefaultMarketingNavbar {...props} />
    </div>
  );
}

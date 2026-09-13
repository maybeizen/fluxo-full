import { t } from "@/theme-system/use-t";

export function getMarketingAnchors() {
  return [
    { href: "#features", label: t("nav.features") },
    { href: "#plans", label: t("nav.plans") },
    { href: "#docs", label: t("nav.docs") },
  ] as const;
}

export const marketingAnchors = [
  { href: "#features", label: "Features" },
  { href: "#plans", label: "Plans" },
  { href: "#docs", label: "Docs" },
] as const;

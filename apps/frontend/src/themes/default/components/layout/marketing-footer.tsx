import { GitForkIcon, MessageCircleIcon } from "lucide-react";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";
import type { MarketingNavItem } from "./marketing-navbar";

export interface MarketingFooterProps {
  items: readonly MarketingNavItem[];
}

export function MarketingFooter({ items }: MarketingFooterProps) {
  const { Badge, Separator } = useUI();
  const productLinks = [...items, { href: "#status", label: t("footer.statusLink") }];
  const resourceLinks = [
    { href: "#docs", label: t("footer.documentation") },
    { href: "#docs", label: t("footer.api") },
    { href: "#docs", label: t("footer.guides") },
    { href: "#docs", label: t("footer.changelog") },
  ];
  const legalLinks = [
    { href: "#legal", label: t("footer.terms") },
    { href: "#legal", label: t("footer.privacy") },
    { href: "#legal", label: t("footer.dpa") },
    { href: "#legal", label: t("footer.acceptableUse") },
  ];

  return (
    <footer className="w-full border-t bg-card">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <a href="/" className="font-heading text-xl tracking-tight italic">
              {t("brand.fluxo")}
            </a>
            <p className="max-w-xs text-sm text-muted-foreground">{t("footer.tagline")}</p>
            <div className="flex items-center gap-2" id="status">
              <span className="size-1.5 rounded-full bg-primary" />
              <Badge variant="outline">{t("footer.status")}</Badge>
            </div>
          </div>
          <FooterColumn title={t("footer.product")} links={productLinks} />
          <FooterColumn id="docs" title={t("footer.resources")} links={resourceLinks} />
          <FooterColumn id="legal" title={t("footer.legal")} links={legalLinks} />
        </div>
        <Separator />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {t("footer.copyright", { year: String(new Date().getFullYear()) })}
          </p>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="GitHub"
            >
              <GitForkIcon className="size-4" />
            </a>
            <a
              href="https://discord.com"
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Discord"
            >
              <MessageCircleIcon className="size-4" />
            </a>
            <a
              href="https://x.com"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              aria-label="X"
            >
              X
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  id,
  title,
  links,
}: {
  id?: string;
  title: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div id={id} className="flex flex-col gap-4">
      <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">{title}</p>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={`${title}-${link.label}`}>
            <a
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

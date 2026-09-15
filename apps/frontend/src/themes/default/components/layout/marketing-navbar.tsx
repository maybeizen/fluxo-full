import { Link } from "@tanstack/react-router";
import { MenuIcon } from "lucide-react";
import { useState } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import type { AccountMenu } from "@/hooks/use-account-menu";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export interface MarketingNavItem {
  href: string;
  label: string;
}

export interface MarketingNavbarProps {
  items: readonly MarketingNavItem[];
  accountMenu: AccountMenu;
}

export function MarketingNavbar({ items, accountMenu }: MarketingNavbarProps) {
  const {
    AvatarDropdown,
    Button,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    Skeleton,
  } = useUI();
  const [open, setOpen] = useState(false);
  const user = accountMenu.user;
  const settings = usePublicSettings();

  return (
    <header className="sticky top-0 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <BrandMark className="font-heading text-xl tracking-tight italic" />
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {accountMenu.isPending ? (
            <Skeleton className="h-8 w-28" />
          ) : user ? (
            <AvatarDropdown
              user={user}
              items={accountMenu.items}
              extraItems={accountMenu.extraItems}
              onSignOut={accountMenu.onSignOut}
            />
          ) : (
            <>
              {settings.authDisableLogin ? null : (
                <Button
                  nativeButton={false}
                  render={<Link to="/login" />}
                  variant="ghost"
                >
                  {t("nav.login")}
                </Button>
              )}
              {settings.authDisableRegistration ? null : (
                <Button nativeButton={false} render={<Link to="/register" />}>
                  {t("nav.getStarted")}
                </Button>
              )}
            </>
          )}
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="md:hidden" />
            }
          >
            <MenuIcon />
            <span className="sr-only">Open navigation</span>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetHeader>
              <SheetTitle className="font-heading italic">
                <BrandMark />
              </SheetTitle>
            </SheetHeader>
            <nav aria-label="Mobile" className="flex flex-col gap-4 px-4">
              {items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm text-muted-foreground"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-2">
                {user ? (
                  <AvatarDropdown
                    user={user}
                    items={accountMenu.items}
                    extraItems={accountMenu.extraItems}
                    onSignOut={accountMenu.onSignOut}
                    className="w-full"
                  />
                ) : (
                  <>
                    {settings.authDisableLogin ? null : (
                      <Button
                        nativeButton={false}
                        render={<Link to="/login" />}
                        variant="outline"
                      >
                        {t("nav.login")}
                      </Button>
                    )}
                    {settings.authDisableRegistration ? null : (
                      <Button
                        nativeButton={false}
                        render={<Link to="/register" />}
                      >
                        {t("nav.getStarted")}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

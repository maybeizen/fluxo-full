import {
  LayoutDashboardIcon,
  LayersIcon,
  LifeBuoyIcon,
  NewspaperIcon,
  ReceiptIcon,
  ShoppingCartIcon,
  StoreIcon,
  type LucideIcon,
} from "lucide-react";
import {
  adminPageLabels,
  isAdminPagePath,
  isAdminPath,
  type AdminPagePath,
} from "@/components/layout/admin-nav";

export interface AppNavItem {
  to:
    | "/dashboard"
    | "/services"
    | "/invoices"
    | "/store"
    | "/cart"
    | "/support"
    | "/news";
  label: string;
  icon: LucideIcon;
}

export type SidebarNavItem = {
  to: AppNavItem["to"] | AdminPagePath;
  label: string;
  icon: LucideIcon;
};

export const appNavItems: readonly AppNavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { to: "/services", label: "Services", icon: LayersIcon },
  { to: "/invoices", label: "Invoices", icon: ReceiptIcon },
  { to: "/store", label: "Store", icon: StoreIcon },
  { to: "/cart", label: "Cart", icon: ShoppingCartIcon },
  { to: "/support", label: "Support", icon: LifeBuoyIcon },
  { to: "/news", label: "News", icon: NewspaperIcon },
];

export const appPageLabels = {
  "/dashboard": "Dashboard",
  "/services": "Services",
  "/invoices": "Invoices",
  "/store": "Store",
  "/cart": "Cart",
  "/support": "Support",
  "/news": "News",
  "/settings": "Settings",
  "/servers": "Servers",
} as const;

export type AppPagePath = keyof typeof appPageLabels;

export interface CrumbItem {
  label: string;
  to?: SidebarNavItem["to"];
}

export function labelForPath(pathname: string): string {
  if (pathname.startsWith("/admin/users/") && pathname !== "/admin/users") {
    return "User";
  }
  if (isAdminPagePath(pathname)) {
    return adminPageLabels[pathname];
  }
  if (isAppPagePath(pathname)) {
    return appPageLabels[pathname];
  }
  return "Dashboard";
}

export function crumbsForPath(pathname: string): CrumbItem[] {
  if (pathname.startsWith("/admin/users/") && pathname !== "/admin/users") {
    return [
      { label: "Users", to: "/admin/users" },
      { label: "User" },
    ];
  }
  return [{ label: labelForPath(pathname) }];
}

export function homePathFor(pathname: string): "/dashboard" | "/admin" {
  return isAdminPath(pathname) ? "/admin" : "/dashboard";
}

function isAppPagePath(pathname: string): pathname is AppPagePath {
  return pathname in appPageLabels;
}

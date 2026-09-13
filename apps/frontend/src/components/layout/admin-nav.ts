import {
  FolderTreeIcon,
  LayersIcon,
  LayoutDashboardIcon,
  LifeBuoyIcon,
  NewspaperIcon,
  PackageIcon,
  PuzzleIcon,
  ReceiptIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  TicketIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type AdminPagePath =
  | "/admin"
  | "/admin/users"
  | "/admin/services"
  | "/admin/invoices"
  | "/admin/products"
  | "/admin/categories"
  | "/admin/support"
  | "/admin/coupons"
  | "/admin/configurable-options"
  | "/admin/news"
  | "/admin/plugins"
  | "/admin/settings";

export interface AdminNavItem {
  to: AdminPagePath;
  label: string;
  icon: LucideIcon;
}

export const adminNavItems: readonly AdminNavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboardIcon },
  { to: "/admin/users", label: "Users", icon: UsersIcon },
  { to: "/admin/services", label: "Services", icon: LayersIcon },
  { to: "/admin/invoices", label: "Invoices", icon: ReceiptIcon },
  { to: "/admin/products", label: "Products", icon: PackageIcon },
  { to: "/admin/categories", label: "Categories", icon: FolderTreeIcon },
  { to: "/admin/support", label: "Support", icon: LifeBuoyIcon },
  { to: "/admin/coupons", label: "Coupons", icon: TicketIcon },
  { to: "/admin/configurable-options", label: "Configurable Options", icon: SlidersHorizontalIcon },
  { to: "/admin/news", label: "News", icon: NewspaperIcon },
  { to: "/admin/plugins", label: "Plugins", icon: PuzzleIcon },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export const adminPageLabels = {
  "/admin": "Dashboard",
  "/admin/users": "Users",
  "/admin/services": "Services",
  "/admin/invoices": "Invoices",
  "/admin/products": "Products",
  "/admin/categories": "Categories",
  "/admin/support": "Support",
  "/admin/coupons": "Coupons",
  "/admin/configurable-options": "Configurable Options",
  "/admin/news": "News",
  "/admin/plugins": "Plugins",
  "/admin/settings": "Settings",
} as const;

export function isAdminPagePath(pathname: string): pathname is AdminPagePath {
  return pathname in adminPageLabels;
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

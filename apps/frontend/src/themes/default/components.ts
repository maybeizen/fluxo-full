import { AvatarDropdown } from "@/themes/default/components/layout/avatar-dropdown";
import { Breadcrumbs } from "@/themes/default/components/layout/breadcrumbs";
import { AppHeader } from "@/themes/default/components/layout/app-header";
import { AppShell } from "@/themes/default/components/layout/app-shell";
import { AppSidebar } from "@/themes/default/components/layout/app-sidebar";
import { MarketingFooter } from "@/themes/default/components/layout/marketing-footer";
import { MarketingNavbar } from "@/themes/default/components/layout/marketing-navbar";
import { AdminDashboard } from "@/themes/default/pages/admin/admin-dashboard";
import { CreateUserDialog } from "@/themes/default/pages/admin/create-user-dialog";
import { DeleteUserDialog } from "@/themes/default/pages/admin/delete-user-dialog";
import { AdminSettingsPage } from "@/themes/default/pages/admin/settings/admin-settings-page";
import { AdminSettingsApplicationTab } from "@/themes/default/pages/admin/settings/application-tab";
import { AdminSettingsAuthenticationTab } from "@/themes/default/pages/admin/settings/authentication-tab";
import { AdminSettingsBillingTab } from "@/themes/default/pages/admin/settings/billing-tab";
import { AdminSettingsIconUploader } from "@/themes/default/pages/admin/settings/icon-uploader";
import { AdminSettingsSecretField } from "@/themes/default/pages/admin/settings/secret-field";
import { AdminSettingsSecurityTab } from "@/themes/default/pages/admin/settings/security-tab";
import { AdminSettingsSmtpTab } from "@/themes/default/pages/admin/settings/smtp-tab";
import { AdminSettingsStorageTab } from "@/themes/default/pages/admin/settings/storage-tab";
import { AdminSettingsToggle } from "@/themes/default/pages/admin/settings/settings-toggle";
import { AdminSettingsThemeTab } from "@/themes/default/pages/admin/settings/theme-tab";
import { UserEditForm } from "@/themes/default/pages/admin/user-edit-form";
import { UserOverviewCard } from "@/themes/default/pages/admin/user-overview-card";
import { UsersTable } from "@/themes/default/pages/admin/users-table";
import { AdminPluginsPage } from "@/themes/default/pages/admin/plugins/plugins-page";
import { AdminPluginsTable } from "@/themes/default/pages/admin/plugins/plugins-table";
import { AdminPluginDetailPage } from "@/themes/default/pages/admin/plugins/plugin-detail-page";
import { AdminPluginConfigForm } from "@/themes/default/pages/admin/plugins/plugin-config-form";
import { AdminPluginInstancesCard } from "@/themes/default/pages/admin/plugins/plugin-instances-card";
import { AuthCard } from "@/themes/default/pages/auth/auth-card";
import { AuthLayout } from "@/themes/default/pages/auth/auth-layout";
import { AuthSocialActions } from "@/themes/default/pages/auth/auth-social-actions";
import { ConfirmEmailView } from "@/themes/default/pages/auth/confirm-email-view";
import { ForgotPasswordForm } from "@/themes/default/pages/auth/forgot-password-form";
import { LoginForm } from "@/themes/default/pages/auth/login-form";
import { MfaForm } from "@/themes/default/pages/auth/mfa-form";
import { RegisterForm } from "@/themes/default/pages/auth/register-form";
import { ResetPasswordForm } from "@/themes/default/pages/auth/reset-password-form";
import { SuspendedPage } from "@/themes/default/pages/auth/suspended-page";
import { DashboardCta } from "@/themes/default/pages/dashboard/dashboard-cta";
import { DashboardEmptyState } from "@/themes/default/pages/dashboard/dashboard-empty-state";
import { DashboardInvoicesPanel } from "@/themes/default/pages/dashboard/dashboard-invoices-panel";
import { DashboardLinksCard } from "@/themes/default/pages/dashboard/dashboard-links-card";
import { DashboardNewsPanel } from "@/themes/default/pages/dashboard/dashboard-news-panel";
import { DashboardPage } from "@/themes/default/pages/dashboard/dashboard-page";
import { DashboardProfileCard } from "@/themes/default/pages/dashboard/dashboard-profile-card";
import { DashboardServicesPanel } from "@/themes/default/pages/dashboard/dashboard-services-panel";
import { DashboardSupportPanel } from "@/themes/default/pages/dashboard/dashboard-support-panel";
import { LandingCta } from "@/themes/default/pages/landing/landing-cta";
import { LandingFeatures } from "@/themes/default/pages/landing/landing-features";
import { LandingHero } from "@/themes/default/pages/landing/landing-hero";
import { LandingPlans } from "@/themes/default/pages/landing/landing-plans";
import { LandingTestimonials } from "@/themes/default/pages/landing/landing-testimonials";
import { BackupCodesPanel } from "@/themes/default/pages/settings/backup-codes-panel";
import { SettingsLayout } from "@/themes/default/pages/settings/settings-layout";
import { StepUpDialog } from "@/themes/default/pages/settings/step-up-dialog";
import { MfaCard } from "@/themes/default/pages/settings/mfa-card";
import { PasskeysCard } from "@/themes/default/pages/settings/passkeys-card";
import { PasswordCard } from "@/themes/default/pages/settings/password-card";
import { ProfileSection } from "@/themes/default/pages/settings/profile-section";
import { SessionsSection } from "@/themes/default/pages/settings/sessions-section";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/themes/default/components/ui/alert";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/themes/default/components/ui/avatar";
import { Badge } from "@/themes/default/components/ui/badge";
import { Button } from "@/themes/default/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/themes/default/components/ui/card";
import { IconButton } from "@/themes/default/components/ui/icon-button";
import { NativeSelect } from "@/themes/default/components/ui/native-select";
import { Textarea } from "@/themes/default/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/themes/default/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/themes/default/components/ui/dropdown-menu";
import { Checkbox } from "@/themes/default/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/themes/default/components/ui/field";
import { Input } from "@/themes/default/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/themes/default/components/ui/input-otp";
import { Label } from "@/themes/default/components/ui/label";
import { ScrollArea } from "@/themes/default/components/ui/scroll-area";
import { Separator } from "@/themes/default/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/themes/default/components/ui/sheet";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/themes/default/components/ui/sidebar";
import { Skeleton } from "@/themes/default/components/ui/skeleton";
import { Spinner } from "@/themes/default/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/themes/default/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/themes/default/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/themes/default/components/ui/tooltip";

export const defaultComponents = {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarDropdown,
  AvatarFallback,
  AvatarImage,
  Badge,
  Breadcrumbs,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  IconButton,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
  Input,
  NativeSelect,
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
  Label,
  ScrollArea,
  Separator,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  Skeleton,
  Spinner,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  AppHeader,
  AppShell,
  AppSidebar,
  MarketingFooter,
  MarketingNavbar,
  AuthCard,
  AuthLayout,
  AuthSocialActions,
  ConfirmEmailView,
  ForgotPasswordForm,
  LoginForm,
  MfaForm,
  RegisterForm,
  ResetPasswordForm,
  SuspendedPage,
  LandingCta,
  LandingFeatures,
  LandingHero,
  LandingPlans,
  LandingTestimonials,
  DashboardPage,
  DashboardProfileCard,
  DashboardLinksCard,
  DashboardCta,
  DashboardEmptyState,
  DashboardServicesPanel,
  DashboardInvoicesPanel,
  DashboardNewsPanel,
  DashboardSupportPanel,
  BackupCodesPanel,
  SettingsLayout,
  StepUpDialog,
  MfaCard,
  PasskeysCard,
  PasswordCard,
  ProfileSection,
  SessionsSection,
  AdminDashboard,
  AdminSettingsPage,
  AdminSettingsApplicationTab,
  AdminSettingsAuthenticationTab,
  AdminSettingsBillingTab,
  AdminSettingsIconUploader,
  AdminSettingsSecretField,
  AdminSettingsSecurityTab,
  AdminSettingsSmtpTab,
  AdminSettingsStorageTab,
  AdminSettingsThemeTab,
  AdminSettingsToggle,
  CreateUserDialog,
  DeleteUserDialog,
  UserEditForm,
  UserOverviewCard,
  UsersTable,
  AdminPluginsPage,
  AdminPluginsTable,
  AdminPluginDetailPage,
  AdminPluginConfigForm,
  AdminPluginInstancesCard,
};

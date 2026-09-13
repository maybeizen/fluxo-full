import {
  ActivityIcon,
  CreditCardIcon,
  LifeBuoyIcon,
  PuzzleIcon,
  ServerIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { t } from "@/theme-system/use-t";

export interface LandingFeature {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface LandingPlan {
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  highlighted: boolean;
  cta: string;
}

export interface LandingTestimonial {
  quote: string;
  name: string;
  role: string;
  initials: string;
}

export function getLandingFeatures(): LandingFeature[] {
  return [
    {
      title: t("landing.features.usage.title"),
      description: t("landing.features.usage.description"),
      icon: CreditCardIcon,
    },
    {
      title: t("landing.features.pterodactyl.title"),
      description: t("landing.features.pterodactyl.description"),
      icon: ServerIcon,
    },
    {
      title: t("landing.features.plugins.title"),
      description: t("landing.features.plugins.description"),
      icon: PuzzleIcon,
    },
    {
      title: t("landing.features.staff.title"),
      description: t("landing.features.staff.description"),
      icon: UsersIcon,
    },
    {
      title: t("landing.features.telemetry.title"),
      description: t("landing.features.telemetry.description"),
      icon: ActivityIcon,
    },
    {
      title: t("landing.features.tickets.title"),
      description: t("landing.features.tickets.description"),
      icon: LifeBuoyIcon,
    },
  ];
}

export function getLandingPlans(): LandingPlan[] {
  return [
    {
      name: t("landing.plans.studio.name"),
      price: t("landing.plans.studio.price"),
      cadence: t("landing.plans.studio.cadence"),
      description: t("landing.plans.studio.description"),
      features: [
        t("landing.plans.studio.feature.0"),
        t("landing.plans.studio.feature.1"),
        t("landing.plans.studio.feature.2"),
        t("landing.plans.studio.feature.3"),
      ],
      highlighted: false,
      cta: t("landing.plans.studio.cta"),
    },
    {
      name: t("landing.plans.operator.name"),
      price: t("landing.plans.operator.price"),
      cadence: t("landing.plans.operator.cadence"),
      description: t("landing.plans.operator.description"),
      features: [
        t("landing.plans.operator.feature.0"),
        t("landing.plans.operator.feature.1"),
        t("landing.plans.operator.feature.2"),
        t("landing.plans.operator.feature.3"),
        t("landing.plans.operator.feature.4"),
      ],
      highlighted: true,
      cta: t("landing.plans.operator.cta"),
    },
    {
      name: t("landing.plans.estate.name"),
      price: t("landing.plans.estate.price"),
      cadence: t("landing.plans.estate.cadence"),
      description: t("landing.plans.estate.description"),
      features: [
        t("landing.plans.estate.feature.0"),
        t("landing.plans.estate.feature.1"),
        t("landing.plans.estate.feature.2"),
        t("landing.plans.estate.feature.3"),
        t("landing.plans.estate.feature.4"),
      ],
      highlighted: false,
      cta: t("landing.plans.estate.cta"),
    },
  ];
}

export function getLandingTestimonials(): LandingTestimonial[] {
  return [
    {
      quote: t("landing.testimonials.0.quote"),
      name: t("landing.testimonials.0.name"),
      role: t("landing.testimonials.0.role"),
      initials: t("landing.testimonials.0.initials"),
    },
    {
      quote: t("landing.testimonials.1.quote"),
      name: t("landing.testimonials.1.name"),
      role: t("landing.testimonials.1.role"),
      initials: t("landing.testimonials.1.initials"),
    },
    {
      quote: t("landing.testimonials.2.quote"),
      name: t("landing.testimonials.2.name"),
      role: t("landing.testimonials.2.role"),
      initials: t("landing.testimonials.2.initials"),
    },
  ];
}

export const landingFeatures = getLandingFeatures;
export const landingPlans = getLandingPlans;
export const landingTestimonials = getLandingTestimonials;

export const heroLedger = [
  { server: "northwind-survival", hours: "612h", amount: "$48.96" },
  { server: "ember-rust-us-east", hours: "408h", amount: "$76.50" },
  { server: "stackline-modpack-3", hours: "297h", amount: "$31.20" },
] as const;

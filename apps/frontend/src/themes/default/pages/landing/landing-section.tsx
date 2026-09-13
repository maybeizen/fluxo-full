import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function LandingSection({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("px-6 py-24", className)}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-14">{children}</div>
    </section>
  );
}

export function LandingSectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs tracking-[0.22em] text-muted-foreground uppercase">{eyebrow}</p>
        <div className="h-px w-8 bg-primary" />
      </div>
      <h2 className="font-heading text-3xl text-balance sm:text-4xl">{title}</h2>
      <p className="text-muted-foreground text-pretty">{description}</p>
    </div>
  );
}

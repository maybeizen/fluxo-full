import { Link } from "@tanstack/react-router";
import { CalendarDaysIcon, MailIcon } from "lucide-react";
import { userInitials, type PublicUser } from "@/lib/auth";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function DashboardProfileCard({
  user,
  joinedLabel,
  profileTo,
}: {
  user: PublicUser;
  joinedLabel: string;
  profileTo: "/settings";
}) {
  const { Avatar, AvatarFallback, AvatarImage, Button, Card, CardContent, CardFooter } = useUI();
  const t = useT();
  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.username;

  return (
    <Card className="flex min-h-0 flex-col gap-0 overflow-hidden p-0">
      <div className="relative h-28 shrink-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_50%_-20%,color-mix(in_oklch,var(--primary)_34%,transparent),transparent_62%)]" />
        <div className="landing-grain absolute inset-0 opacity-40" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
      </div>
      <CardContent className="flex min-h-0 flex-1 flex-col items-center px-5 pb-0">
        <Avatar className="-mt-10 size-20 ring-4 ring-card">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
          <AvatarFallback>{userInitials(user)}</AvatarFallback>
        </Avatar>
        <div className="mt-3 flex min-w-0 flex-col items-center gap-0.5 text-center">
          <p className="font-heading text-xl font-medium tracking-tight">{fullName}</p>
          <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
        </div>
        <dl className="mt-6 flex w-full min-h-0 flex-1 flex-col justify-center gap-3">
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
            <MailIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                {t("dashboard.profile.email")}
              </dt>
              <dd className="truncate text-sm">{user.email}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
            <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <dt className="sr-only">{t("dashboard.profile.joinedLabel")}</dt>
              <dd className="text-sm">{t("dashboard.profile.joined", { date: joinedLabel })}</dd>
            </div>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="mt-4">
        <Button nativeButton={false} render={<Link to={profileTo} />} className="w-full">
          {t("dashboard.profile.edit")}
        </Button>
      </CardFooter>
    </Card>
  );
}

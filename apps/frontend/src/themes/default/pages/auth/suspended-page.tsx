import { BanIcon, LogOutIcon } from "lucide-react";
import type { PublicUser } from "@/lib/auth";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function SuspendedPage({ user, onSignOut }: { user: PublicUser; onSignOut: () => void }) {
  const {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
  } = useUI();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col items-center gap-3">
          <span className="font-heading text-xl tracking-tight italic">{t("brand.fluxo")}</span>
          <div className="h-px w-12 bg-primary" />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{t("auth.suspended.title")}</CardTitle>
            <CardDescription>
              {t("auth.suspended.description", { username: user.username })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <BanIcon />
              <AlertTitle>{t("auth.suspended.alertTitle")}</AlertTitle>
              <AlertDescription>
                {user.suspendedReason ?? t("auth.suspended.defaultReason")}
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="justify-end">
            <Button variant="outline" onClick={onSignOut}>
              <LogOutIcon data-icon="inline-start" />
              {t("auth.suspended.signOut")}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

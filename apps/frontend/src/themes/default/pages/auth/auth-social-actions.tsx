import { FingerprintIcon } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";
import { GitHubIcon, GoogleIcon } from "./icons";

export function AuthSocialActions({
  onPasskey,
  passkeyPending,
}: {
  onPasskey?: () => void;
  passkeyPending?: boolean;
}) {
  const { Button, Separator } = useUI();

  function announceComingSoon(): void {
    toast(t("auth.social.comingSoon"));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">{t("auth.social.or")}</span>
        <Separator className="flex-1" />
      </div>
      <div className="flex flex-col gap-2">
        <Button className="w-full" type="button" variant="outline" onClick={announceComingSoon}>
          <GoogleIcon data-icon="inline-start" />
          {t("auth.social.google")}
        </Button>
        <Button className="w-full" type="button" variant="outline" onClick={announceComingSoon}>
          <GitHubIcon data-icon="inline-start" />
          {t("auth.social.github")}
        </Button>
        <Button
          className="w-full"
          type="button"
          variant="outline"
          disabled={passkeyPending}
          onClick={onPasskey ?? announceComingSoon}
        >
          <FingerprintIcon data-icon="inline-start" />
          {passkeyPending ? t("auth.social.passkeyWaiting") : t("auth.social.passkey")}
        </Button>
      </div>
    </div>
  );
}

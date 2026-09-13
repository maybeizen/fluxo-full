import { CircleCheckIcon, MailIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ConfirmEmailViewModel } from "@/hooks/use-confirm-email";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function ConfirmEmailView({ view, pending, error, onResend }: ConfirmEmailViewModel) {
  const { AuthCard, Button, FieldError } = useUI();

  if (view === "success") {
    return (
      <AuthCard
        title={t("auth.confirm.successTitle")}
        description={t("auth.confirm.successDescription")}
        footer={
          <Button variant="link" nativeButton={false} render={<Link to="/login" />}>
            {t("auth.confirm.continue")}
          </Button>
        }
      >
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <CircleCheckIcon />
          </span>
          <p className="text-sm text-muted-foreground">{t("auth.confirm.successBody")}</p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("auth.confirm.title")}
      description={t("auth.confirm.description")}
      footer={
        <Button variant="link" nativeButton={false} render={<Link to="/login" />}>
          {t("auth.confirm.back")}
        </Button>
      }
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-primary">
          <MailIcon />
        </span>
        <p className="text-sm text-muted-foreground">
          {pending ? t("auth.confirm.pending") : t("auth.confirm.waiting")}
        </p>
        {error ? <FieldError>{error}</FieldError> : null}
        <Button
          className="w-full"
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onResend}
        >
          {t("auth.confirm.resend")}
        </Button>
      </div>
    </AuthCard>
  );
}

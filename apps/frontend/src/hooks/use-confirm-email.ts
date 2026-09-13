import { useEffect, useState } from "react";
import { toast } from "sonner";
import { confirmEmail } from "@/lib/auth-api";
import { AuthApiError } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

export function useConfirmEmail(status: "waiting" | "success", token?: string) {
  const [view, setView] = useState<"waiting" | "success">(status);
  const [pending, setPending] = useState(Boolean(token) && status !== "success");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!token || status === "success") {
      return;
    }

    let cancelled = false;
    setPending(true);

    void confirmEmail({ token })
      .then(() => {
        if (!cancelled) {
          setView("success");
          setError(undefined);
        }
      })
      .catch((confirmError: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          confirmError instanceof AuthApiError
            ? confirmError.message
            : t("auth.confirm.unable");
        setError(message);
      })
      .finally(() => {
        if (!cancelled) {
          setPending(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [status, token]);

  return {
    view,
    pending,
    error,
    onResend: () => {
      toast(t("auth.confirm.resent"));
    },
  };
}

export type ConfirmEmailViewModel = ReturnType<typeof useConfirmEmail>;

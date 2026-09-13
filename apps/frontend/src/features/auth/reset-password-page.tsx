import { useResetPassword } from "@/hooks/use-reset-password";
import { useUI } from "@/theme-system";

export function ResetPasswordPage({ token }: { token?: string }) {
  const { ResetPasswordForm } = useUI();
  const reset = useResetPassword(token);
  return <ResetPasswordForm {...reset} />;
}

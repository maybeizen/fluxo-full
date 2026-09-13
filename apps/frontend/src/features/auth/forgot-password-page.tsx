import { useForgotPassword } from "@/hooks/use-forgot-password";
import { useUI } from "@/theme-system";

export function ForgotPasswordPage() {
  const { ForgotPasswordForm } = useUI();
  const forgot = useForgotPassword();
  return <ForgotPasswordForm {...forgot} />;
}

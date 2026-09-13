import { useLogin } from "@/hooks/use-login";
import { useUI } from "@/theme-system";

export function LoginPage() {
  const { LoginForm } = useUI();
  const login = useLogin();
  return <LoginForm {...login} />;
}

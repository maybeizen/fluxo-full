import { PluginSlot, toPluginPublicSettings } from "@/plugin-system";
import { useLogin } from "@/hooks/use-login";
import { usePublicSettings } from "@/hooks/use-public-settings";
import { useUI } from "@/theme-system";

export function LoginPage() {
  const { LoginForm } = useUI();
  const login = useLogin();
  const settings = usePublicSettings();
  return (
    <LoginForm
      {...login}
      extra={<PluginSlot point="auth.login.extra" slotProps={{ settings: toPluginPublicSettings(settings) }} />}
    />
  );
}

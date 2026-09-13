import { useMfa } from "@/hooks/use-mfa";
import { useUI } from "@/theme-system";

export function MfaPage() {
  const { MfaForm } = useUI();
  const mfa = useMfa();
  return <MfaForm {...mfa} />;
}

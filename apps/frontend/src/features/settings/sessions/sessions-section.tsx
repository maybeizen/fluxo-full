import { useSessions } from "@/hooks/use-sessions";
import { useUI } from "@/theme-system";

export function SessionsSection() {
  const { SessionsSection: View } = useUI();
  const sessions = useSessions();
  return <View {...sessions} />;
}

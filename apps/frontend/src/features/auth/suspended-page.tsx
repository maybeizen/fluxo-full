import { useAccountMenu } from "@/hooks/use-account-menu";
import type { PublicUser } from "@/lib/auth";
import { useUI } from "@/theme-system";

export function SuspendedPage({ user }: { user: PublicUser }) {
  const { SuspendedPage: View } = useUI();
  const { onSignOut } = useAccountMenu();
  return <View user={user} onSignOut={onSignOut} />;
}

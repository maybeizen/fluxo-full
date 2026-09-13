import { useConfirmEmail } from "@/hooks/use-confirm-email";
import { useUI } from "@/theme-system";

export function ConfirmEmailPage({
  status,
  token,
}: {
  status: "waiting" | "success";
  token?: string;
}) {
  const { ConfirmEmailView } = useUI();
  const confirm = useConfirmEmail(status, token);
  return <ConfirmEmailView {...confirm} />;
}

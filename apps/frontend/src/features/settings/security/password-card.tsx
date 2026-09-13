import { usePasswordCard } from "@/hooks/use-password-card";
import { useStepUpDialog } from "@/hooks/use-step-up-dialog";
import type { PublicUser } from "@/lib/auth";
import { useUI } from "@/theme-system";

export function PasswordCard({ user, token }: { user: PublicUser; token?: string }) {
  const { PasswordCard: View, StepUpDialog } = useUI();
  const password = usePasswordCard(user, token);
  const stepUpDialog = useStepUpDialog({
    onOpenChange: password.stepUp.setOpen,
    onVerified: password.stepUp.complete,
  });

  return (
    <>
      <View {...password} />
      <StepUpDialog user={user} open={password.stepUp.open} {...stepUpDialog} />
    </>
  );
}

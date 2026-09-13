import { usePasskeys } from "@/hooks/use-passkeys";
import { useStepUpDialog } from "@/hooks/use-step-up-dialog";
import type { PublicUser } from "@/lib/auth";
import { useUI } from "@/theme-system";

export function PasskeysCard({ user }: { user: PublicUser }) {
  const { PasskeysCard: View, StepUpDialog } = useUI();
  const passkeys = usePasskeys(user);
  const stepUpDialog = useStepUpDialog({
    onOpenChange: passkeys.stepUp.setOpen,
    onVerified: passkeys.stepUp.complete,
  });

  return (
    <>
      <View {...passkeys} />
      <StepUpDialog user={user} open={passkeys.stepUp.open} {...stepUpDialog} />
    </>
  );
}

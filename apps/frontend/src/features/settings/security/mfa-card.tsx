import { useMfaCard } from "@/hooks/use-mfa-card";
import { useStepUpDialog } from "@/hooks/use-step-up-dialog";
import type { PublicUser } from "@/lib/auth";
import { useUI } from "@/theme-system";

export function MfaCard({ user }: { user: PublicUser }) {
  const { MfaCard: View, StepUpDialog } = useUI();
  const mfa = useMfaCard(user);
  const stepUpDialog = useStepUpDialog({
    onOpenChange: mfa.stepUp.setOpen,
    onVerified: mfa.stepUp.complete,
  });

  return (
    <>
      <View {...mfa} />
      <StepUpDialog user={user} open={mfa.stepUp.open} {...stepUpDialog} />
    </>
  );
}

import { useAvatar } from "@/hooks/use-avatar";
import { useStepUpDialog } from "@/hooks/use-step-up-dialog";
import { useUpdateProfile } from "@/hooks/use-update-profile";
import type { PublicUser } from "@/lib/auth";
import { useUI } from "@/theme-system";

export function ProfileSection({ user }: { user: PublicUser }) {
  const { ProfileSection: View, StepUpDialog } = useUI();
  const profile = useUpdateProfile(user);
  const avatar = useAvatar(user);
  const stepUpDialog = useStepUpDialog({
    onOpenChange: profile.stepUp.setOpen,
    onVerified: profile.stepUp.complete,
  });

  return (
    <>
      <View profile={profile} avatar={avatar} />
      <StepUpDialog user={user} open={profile.stepUp.open} {...stepUpDialog} />
    </>
  );
}

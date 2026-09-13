import type { PublicUser } from "@/lib/auth";

export class StepUpCancelledError extends Error {
  constructor() {
    super("Verification cancelled.");
    this.name = "StepUpCancelledError";
  }
}

export function needsStepUp(user: PublicUser): boolean {
  return user.mfaEnabled || user.hasPasskey;
}

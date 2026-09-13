import { CheckIcon, XIcon } from "lucide-react";

export function VerifiedStatus({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex text-success" aria-label="Verified">
        <CheckIcon className="size-4" />
      </span>
    );
  }

  return (
    <span className="inline-flex text-destructive" aria-label="Not verified">
      <XIcon className="size-4" />
    </span>
  );
}

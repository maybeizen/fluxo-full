import type { PublicUser } from "@/lib/auth";
import { MfaCard } from "./mfa-card";
import { PasskeysCard } from "./passkeys-card";
import { PasswordCard } from "./password-card";

export function SecuritySection({ user, token }: { user: PublicUser; token?: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PasswordCard user={user} token={token} />
      <MfaCard user={user} />
      <PasskeysCard user={user} />
    </div>
  );
}

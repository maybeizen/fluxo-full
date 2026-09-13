import { FingerprintIcon, KeyRoundIcon, ShieldCheckIcon } from "lucide-react";
import type { AdminUserDetail, AdminUserListItem } from "@/features/admin/types";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

type SignInSource = Pick<AdminUserListItem, "mfaEnabled" | "hasPasskey"> & {
  passkeys?: AdminUserDetail["passkeys"];
};

function methodList(user: SignInSource) {
  const passkeyNames = (user.passkeys ?? [])
    .map((passkey) => passkey.name.trim())
    .filter((name) => name.length > 0);
  const methods = [
    { id: "password", label: t("admin.signin.password"), icon: KeyRoundIcon, detail: null as string | null },
  ];
  if (user.mfaEnabled) {
    methods.push({
      id: "authenticator",
      label: t("admin.signin.authenticator"),
      icon: ShieldCheckIcon,
      detail: null,
    });
  }
  if (user.hasPasskey) {
    methods.push({
      id: "passkey",
      label: passkeyNames.length === 1 ? t("admin.signin.passkey") : t("admin.signin.passkeys"),
      icon: FingerprintIcon,
      detail: passkeyNames.length > 0 ? passkeyNames.join(", ") : null,
    });
  }
  return methods;
}

export function SignInMethodIcons({ user }: { user: SignInSource }) {
  const methods = methodList(user);
  return (
    <div
      className="flex items-center gap-1.5 text-muted-foreground"
      aria-label={methods.map((method) => method.label).join(", ")}
    >
      {methods.map((method) => {
        const Icon = method.icon;
        return <Icon key={method.id} className="size-4" />;
      })}
    </div>
  );
}

export function SignInMethods({ user }: { user: AdminUserDetail }) {
  const { Card, CardContent, CardDescription, CardHeader, CardTitle } = useUI();
  const methods = methodList(user);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.signin.title")}</CardTitle>
        <CardDescription>{t("admin.signin.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <li key={method.id} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{method.label}</p>
                  {method.detail ? (
                    <p className="truncate text-xs text-muted-foreground">{method.detail}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

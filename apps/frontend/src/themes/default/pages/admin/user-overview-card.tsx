import { formatRole } from "@/features/admin/format";
import type { AdminUserDetail } from "@/features/admin/types";
import { UserRole, userInitials } from "@/lib/auth";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";
import { CopyableId } from "./copyable-id";

export function UserOverviewCard({ user }: { user: AdminUserDetail }) {
  const { Avatar, AvatarFallback, AvatarImage, Badge, Card, CardContent } = useUI();
  const fullName = `${user.firstName} ${user.lastName}`.trim() || user.username;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
            <AvatarFallback>{userInitials(user)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-heading text-base font-medium">{fullName}</p>
              <Badge variant={user.role === UserRole.Admin ? "default" : "secondary"}>
                {formatRole(user.role)}
              </Badge>
              {user.suspended ? <Badge variant="destructive">{t("admin.edit.suspended")}</Badge> : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">@{user.username}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <CopyableId id={user.id} full className="break-all text-left text-sm" />
      </CardContent>
    </Card>
  );
}

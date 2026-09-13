import { Link } from "@tanstack/react-router";
import { PencilIcon } from "lucide-react";
import { formatJoined, formatRole } from "@/features/admin/format";
import type { AdminUserListItem } from "@/features/admin/types";
import { UserRole } from "@/lib/auth";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";
import { CopyableId } from "./copyable-id";
import { SignInMethodIcons } from "./sign-in-methods";
import { VerifiedStatus } from "./verified-status";

export function UsersTable({
  users,
  currentUserId,
  deletingId,
  onDelete,
}: {
  users: AdminUserListItem[];
  currentUserId: string;
  deletingId?: string;
  onDelete: (user: AdminUserListItem) => void;
}) {
  const {
    Avatar,
    AvatarFallback,
    AvatarImage,
    Badge,
    DeleteUserDialog,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } = useUI();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.users.column.id")}</TableHead>
          <TableHead>{t("admin.users.column.username")}</TableHead>
          <TableHead>{t("admin.users.column.email")}</TableHead>
          <TableHead>{t("admin.users.column.role")}</TableHead>
          <TableHead>{t("admin.users.column.signIn")}</TableHead>
          <TableHead>{t("admin.users.column.verified")}</TableHead>
          <TableHead>{t("admin.users.column.joined")}</TableHead>
          <TableHead className="text-right">{t("admin.users.column.actions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          return (
            <TableRow key={user.id}>
              <TableCell>
                <CopyableId id={user.id} />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar size="sm">
                    {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
                    <AvatarFallback>{user.username.slice(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium">{user.username}</span>
                </div>
              </TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>
                <Badge variant={user.role === UserRole.Admin ? "default" : "secondary"}>
                  {formatRole(user.role)}
                </Badge>
              </TableCell>
              <TableCell>
                <SignInMethodIcons user={user} />
              </TableCell>
              <TableCell>
                <VerifiedStatus verified={user.emailVerified} />
              </TableCell>
              <TableCell>{formatJoined(user.createdAt)}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-1.5">
                  <IconButton
                    label={t("admin.users.edit")}
                    nativeButton={false}
                    render={<Link to="/admin/users/$id" params={{ id: user.id }} />}
                  >
                    <PencilIcon />
                  </IconButton>
                  <DeleteUserDialog
                    user={user}
                    disabled={isSelf}
                    pending={deletingId === user.id}
                    onConfirm={() => onDelete(user)}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

import { Link } from "@tanstack/react-router";
import { useAdminUserEditor } from "@/hooks/use-admin-user-editor";
import { useT, useUI } from "@/theme-system";

export function UserEditPage({
  userId,
  currentUserId,
}: {
  userId: string;
  currentUserId: string;
}) {
  const t = useT();
  const { Button, Card, CardDescription, CardFooter, CardHeader, CardTitle, Skeleton, UserEditForm } =
    useUI();
  const editor = useAdminUserEditor(userId, currentUserId);

  if (editor.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (editor.isError || !editor.user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("admin.edit.notFoundTitle")}</CardTitle>
          <CardDescription>{t("admin.edit.notFoundDescription")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button nativeButton={false} render={<Link to="/admin/users" />} variant="outline">
            {t("admin.edit.back")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return <UserEditForm {...editor} user={editor.user} />;
}

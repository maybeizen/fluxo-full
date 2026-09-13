import { useState } from "react";
import { Trash2Icon } from "lucide-react";
import type { AdminUserListItem } from "@/features/admin/types";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function DeleteUserDialog({
  user,
  disabled,
  pending,
  onConfirm,
}: {
  user: AdminUserListItem;
  disabled: boolean;
  pending: boolean;
  onConfirm: () => void;
}) {
  const {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    IconButton,
    Spinner,
  } = useUI();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <IconButton
        label={t("admin.users.delete")}
        variant="destructive"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Trash2Icon />
      </IconButton>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.delete.title", { username: user.username })}</DialogTitle>
          <DialogDescription>{t("admin.delete.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("admin.delete.cancel")}
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? t("admin.delete.deleting") : t("admin.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

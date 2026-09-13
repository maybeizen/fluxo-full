import { toast } from "sonner";
import { truncateId } from "@/features/admin/format";
import { cn } from "@/lib/cn";
import { t } from "@/theme-system/use-t";

export function CopyableId({
  id,
  className,
  buttonId,
  full = false,
}: {
  id: string;
  className?: string;
  buttonId?: string;
  full?: boolean;
}) {
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(id);
      toast.success(t("admin.users.idCopied"));
    } catch {
      toast.error(t("admin.users.idCopyUnable"));
    }
  }

  return (
    <button
      type="button"
      id={buttonId}
      onClick={() => {
        void copy();
      }}
      title={id}
      aria-label={`Copy user ID ${id}`}
      className={cn(
        "font-mono text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline",
        className,
      )}
    >
      {full ? id : truncateId(id)}
    </button>
  );
}

import type { ChangeEvent } from "react";
import { useRef } from "react";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsIconUploader({
  iconUrl,
  busy,
  onUpload,
  onDelete,
}: {
  iconUrl?: string | null;
  busy: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  const { Button, Field, FieldLabel } = useUI();
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  function onIcon(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      onUpload(file);
    }
  }

  return (
    <Field>
      <FieldLabel>{t("admin.settings.appIcon")}</FieldLabel>
      <div className="flex items-center gap-4">
        {iconUrl ? (
          <img
            key={iconUrl}
            src={iconUrl}
            alt=""
            className="size-12 rounded-lg border object-cover"
          />
        ) : (
          <div className="size-12 rounded-lg border bg-muted" />
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={onIcon}
          />
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {t("admin.settings.iconUpload")}
          </Button>
          {iconUrl ? (
            <Button type="button" variant="ghost" disabled={busy} onClick={onDelete}>
              {t("admin.settings.iconRemove")}
            </Button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

import { ImageUpIcon, Trash2Icon, UserRoundIcon } from "lucide-react";
import type { AvatarFieldModel } from "@/hooks/use-avatar";
import { userInitials } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { t } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AvatarField({
  user,
  inputRef,
  pendingFile,
  dragging,
  setDragging,
  busy,
  displayUrl,
  disabled,
  onInput,
  onDrop,
  onUpload,
  onGravatar,
  onRemove,
  clearPreview,
  openFilePicker,
}: AvatarFieldModel) {
  const { Avatar, AvatarFallback, AvatarImage, Button, FieldDescription, Spinner } = useUI();

  return (
    <div className="flex w-full flex-col items-center gap-4 lg:w-56">
      <div
        className={cn(
          "flex w-full flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4 transition-colors",
          dragging && "border-primary/50 bg-accent/40",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <button
          type="button"
          className="rounded-full outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Choose profile photo"
          disabled={disabled}
          onClick={openFilePicker}
        >
          <Avatar className="size-20">
            {displayUrl ? <AvatarImage src={displayUrl} alt="" /> : null}
            <AvatarFallback>{userInitials(user)}</AvatarFallback>
          </Avatar>
        </button>
        <p className="text-center text-sm text-muted-foreground">{t("settings.avatar.drop")}</p>
        <input
          ref={inputRef}
          id="profile-avatar"
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onInput}
        />
      </div>
      {pendingFile ? (
        <FieldDescription>
          {t("settings.avatar.preview", { name: pendingFile.name })}
        </FieldDescription>
      ) : null}
      <div className="flex w-full flex-col gap-2">
        {pendingFile ? (
          <>
            <Button type="button" disabled={disabled} onClick={() => void onUpload()}>
              {busy === "upload" ? <Spinner data-icon="inline-start" /> : <ImageUpIcon data-icon="inline-start" />}
              {busy === "upload" ? t("settings.avatar.saving") : t("settings.avatar.save")}
            </Button>
            <Button type="button" variant="ghost" disabled={disabled} onClick={clearPreview}>
              {t("settings.avatar.cancel")}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" disabled={disabled} onClick={openFilePicker}>
            <ImageUpIcon data-icon="inline-start" />
            {t("settings.avatar.upload")}
          </Button>
        )}
        <Button type="button" variant="outline" disabled={disabled} onClick={() => void onGravatar()}>
          {busy === "gravatar" ? <Spinner data-icon="inline-start" /> : <UserRoundIcon data-icon="inline-start" />}
          {busy === "gravatar" ? t("settings.avatar.applying") : t("settings.avatar.gravatar")}
        </Button>
        {user.avatarSource !== "none" || user.avatarUrl ? (
          <Button type="button" variant="ghost" disabled={disabled} onClick={() => void onRemove()}>
            {busy === "remove" ? <Spinner data-icon="inline-start" /> : <Trash2Icon data-icon="inline-start" />}
            {t("settings.avatar.remove")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

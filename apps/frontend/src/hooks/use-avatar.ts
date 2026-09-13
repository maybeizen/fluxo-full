import { type ChangeEvent, type DragEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useRefreshSession } from "@/features/settings/use-refresh-session";
import { applyGravatarAvatar, deleteAvatar, uploadAvatar } from "@/lib/auth-api";
import { AuthApiError, type PublicUser } from "@/lib/auth";
import { t } from "@/theme-system/use-t";

const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const maxBytes = 2 * 1024 * 1024;

export function useAvatar(user: PublicUser) {
  const refreshSession = useRefreshSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"upload" | "gravatar" | "remove" | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function clearPreview(): void {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setPendingFile(null);
  }

  function acceptFile(file: File | undefined): void {
    if (!file) {
      return;
    }
    if (!acceptedTypes.has(file.type)) {
      toast.error(t("settings.avatar.typeError"));
      return;
    }
    if (file.size > maxBytes) {
      toast.error(t("settings.avatar.sizeError"));
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function onInput(event: ChangeEvent<HTMLInputElement>): void {
    acceptFile(event.target.files?.[0]);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragging(false);
    acceptFile(event.dataTransfer.files[0]);
  }

  async function onUpload(): Promise<void> {
    if (!pendingFile) {
      return;
    }
    setBusy("upload");
    try {
      const next = await uploadAvatar(pendingFile);
      await refreshSession(next);
      clearPreview();
      toast.success(t("settings.avatar.updated"));
    } catch (error) {
      toast.error(error instanceof AuthApiError ? error.message : t("settings.avatar.uploadUnable"));
    } finally {
      setBusy(null);
    }
  }

  async function onGravatar(): Promise<void> {
    setBusy("gravatar");
    try {
      const next = await applyGravatarAvatar();
      await refreshSession(next);
      clearPreview();
      toast.success(t("settings.avatar.gravatarApplied"));
    } catch (error) {
      toast.error(error instanceof AuthApiError ? error.message : t("settings.avatar.gravatarUnable"));
    } finally {
      setBusy(null);
    }
  }

  async function onRemove(): Promise<void> {
    setBusy("remove");
    try {
      const next = await deleteAvatar();
      await refreshSession(next);
      clearPreview();
      toast.success(t("settings.avatar.removed"));
    } catch (error) {
      toast.error(error instanceof AuthApiError ? error.message : t("settings.avatar.removeUnable"));
    } finally {
      setBusy(null);
    }
  }

  return {
    user,
    inputRef,
    previewUrl,
    pendingFile,
    dragging,
    setDragging,
    busy,
    displayUrl: previewUrl ?? user.avatarUrl,
    disabled: busy !== null,
    onInput,
    onDrop,
    onUpload,
    onGravatar,
    onRemove,
    clearPreview,
    openFilePicker: () => inputRef.current?.click(),
  };
}

export type AvatarFieldModel = ReturnType<typeof useAvatar>;

import type { AdminSettingsSecretDraft } from "@/hooks/use-admin-settings";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsSecretField({
  id,
  label,
  description,
  set,
  draft,
  onDraft,
}: {
  id: string;
  label: string;
  description?: string;
  set: boolean;
  draft: AdminSettingsSecretDraft;
  onDraft: (next: AdminSettingsSecretDraft) => void;
}) {
  const { Button, Field, FieldDescription, FieldLabel, Input } = useUI();
  const t = useT();
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="password"
        autoComplete="new-password"
        value={draft.clear ? "" : draft.value}
        placeholder={set && !draft.clear ? t("admin.settings.secretSet") : undefined}
        disabled={draft.clear}
        onChange={(event) => onDraft({ value: event.target.value, clear: false })}
      />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {set || draft.clear ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onDraft({ value: "", clear: !draft.clear })}
        >
          {draft.clear ? t("admin.settings.secretKeep") : t("admin.settings.secretClear")}
        </Button>
      ) : null}
    </Field>
  );
}

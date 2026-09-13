import type { AdminSettingsModel } from "@/hooks/use-admin-settings";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsThemeTab({ model }: { model: AdminSettingsModel }) {
  const { Field, FieldDescription, FieldGroup } = useUI();
  const t = useT();
  return (
    <FieldGroup>
      <FieldDescription>{t("admin.settings.themeHelp")}</FieldDescription>
      {model.themes.map((theme) => (
        <Field key={theme.id} orientation="horizontal">
          <input
            id={`theme-${theme.id}`}
            type="radio"
            name="activeThemeId"
            className="size-4 accent-primary"
            checked={model.activeThemeId === theme.id}
            onChange={() => model.setActiveThemeId(theme.id)}
          />
          <label htmlFor={`theme-${theme.id}`} className="flex flex-col gap-1">
            <span className="text-sm font-medium">{theme.name}</span>
            <span className="text-sm text-muted-foreground">{theme.description}</span>
          </label>
        </Field>
      ))}
    </FieldGroup>
  );
}

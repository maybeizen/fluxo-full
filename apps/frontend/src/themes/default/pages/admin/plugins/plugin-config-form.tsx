import { type FormEvent } from "react";
import type { JsonValue, PluginConfigField } from "@fluxo/forge";
import type { AdminPluginConfigFormModel } from "@/features/admin/plugins/use-admin-plugin";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

function numberInputValue(value: JsonValue | undefined): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function stringValue(value: JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function selectedValues(value: JsonValue | undefined): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function ConfigField({
  field,
  model,
}: {
  field: PluginConfigField;
  model: AdminPluginConfigFormModel;
}) {
  const t = useT();
  const {
    AdminSettingsSecretField,
    AdminSettingsToggle,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
    Input,
    NativeSelect,
    Textarea,
    Checkbox,
  } = useUI();
  const error = model.errors[field.key];
  const invalid = Boolean(error) || undefined;
  const fieldId = `plugin-config-${field.key}`;

  if (field.type === "secret") {
    return (
      <AdminSettingsSecretField
        id={fieldId}
        label={field.label}
        description={field.description}
        set={model.secretKeysSet.includes(field.key)}
        draft={model.secrets[field.key] ?? { value: "", clear: false }}
        onDraft={(next) => model.onSecret(field.key, next)}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <div>
        <AdminSettingsToggle
          id={fieldId}
          label={field.label}
          description={field.description}
          checked={model.values[field.key] === true}
          onChange={(value) => model.onValue(field.key, value)}
        />
        {error ? <FieldError>{error}</FieldError> : null}
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
        <NativeSelect
          id={fieldId}
          value={stringValue(model.values[field.key])}
          aria-invalid={invalid}
          onChange={(event) => model.onValue(field.key, event.target.value)}
        >
          <option value="">{t("admin.plugins.config.selectPlaceholder")}</option>
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelect>
        {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "multiselect") {
    const selected = selectedValues(model.values[field.key]);
    return (
      <Field data-invalid={invalid}>
        <FieldLabel>{field.label}</FieldLabel>
        <div className="flex flex-col gap-2">
          {field.options.map((option) => {
            const optionId = `${fieldId}-${option.value}`;
            const checked = selected.includes(option.value);
            return (
              <label key={option.value} htmlFor={optionId} className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={optionId}
                  checked={checked}
                  onCheckedChange={(value) => {
                    const on = value === true;
                    const next = on
                      ? [...selected, option.value]
                      : selected.filter((item) => item !== option.value);
                    model.onValue(field.key, next);
                  }}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "textarea") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
        <Textarea
          id={fieldId}
          value={stringValue(model.values[field.key])}
          aria-invalid={invalid}
          onChange={(event) => model.onValue(field.key, event.target.value)}
        />
        {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  if (field.type === "number") {
    return (
      <Field data-invalid={invalid}>
        <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
        <Input
          id={fieldId}
          type="number"
          value={numberInputValue(model.values[field.key])}
          aria-invalid={invalid}
          onChange={(event) => {
            const next = event.target.value;
            if (next.length === 0) {
              model.onValue(field.key, "");
              return;
            }
            model.onValue(field.key, Number(next));
          }}
        />
        {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
        {error ? <FieldError>{error}</FieldError> : null}
      </Field>
    );
  }

  const inputType = field.type === "email" ? "email" : field.type === "url" ? "url" : "text";
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
      <Input
        id={fieldId}
        type={inputType}
        value={stringValue(model.values[field.key])}
        aria-invalid={invalid}
        onChange={(event) => model.onValue(field.key, event.target.value)}
      />
      {field.description ? <FieldDescription>{field.description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
}

export function AdminPluginConfigForm({
  model,
  title,
  description,
}: {
  model: AdminPluginConfigFormModel;
  title: string;
  description: string;
}) {
  const t = useT();
  const {
    Alert,
    AlertDescription,
    AlertTitle,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
    FieldGroup,
    Spinner,
  } = useUI();

  return (
    <Card>
      <form
        className="flex flex-col"
        onSubmit={(event: FormEvent) => {
          model.onSubmit(event);
        }}
      >
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {model.formError ? (
            <Alert variant="destructive">
              <AlertTitle>{t("admin.plugins.detail.saveFailed")}</AlertTitle>
              <AlertDescription>{model.formError}</AlertDescription>
            </Alert>
          ) : null}
          {model.schema.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("admin.plugins.detail.noConfig")}</p>
          ) : (
            <FieldGroup>
              {model.schema.map((field) => (
                <ConfigField key={field.key} field={field} model={model} />
              ))}
            </FieldGroup>
          )}
        </CardContent>
        {model.schema.length > 0 ? (
          <CardFooter>
            <Button type="submit" disabled={model.pending}>
              {model.pending ? <Spinner /> : null}
              {model.pending ? t("admin.plugins.detail.saving") : t("admin.plugins.detail.save")}
            </Button>
          </CardFooter>
        ) : null}
      </form>
    </Card>
  );
}

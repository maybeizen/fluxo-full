import type { AdminSettingsModel } from "@/hooks/use-admin-settings";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsStorageTab({ model }: { model: AdminSettingsModel }) {
  const {
    AdminSettingsSecretField,
    AdminSettingsToggle,
    Field,
    FieldGroup,
    FieldLabel,
    Input,
    NativeSelect,
  } = useUI();
  const t = useT();
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="settings-storage-provider">{t("admin.settings.storageProvider")}</FieldLabel>
        <NativeSelect
          id="settings-storage-provider"
          value={model.storageProvider}
          onChange={(event) => model.setStorageProvider(event.target.value as "local" | "s3")}
        >
          <option value="local">{t("admin.settings.storageLocal")}</option>
          <option value="s3">{t("admin.settings.storageS3")}</option>
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-s3-endpoint">{t("admin.settings.s3Endpoint")}</FieldLabel>
        <Input
          id="settings-s3-endpoint"
          value={model.s3Endpoint}
          onChange={(event) => model.setS3Endpoint(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-s3-region">{t("admin.settings.s3Region")}</FieldLabel>
        <Input
          id="settings-s3-region"
          value={model.s3Region}
          onChange={(event) => model.setS3Region(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-s3-bucket">{t("admin.settings.s3Bucket")}</FieldLabel>
        <Input
          id="settings-s3-bucket"
          value={model.s3Bucket}
          onChange={(event) => model.setS3Bucket(event.target.value)}
        />
      </Field>
      <AdminSettingsSecretField
        id="settings-s3-access"
        label={t("admin.settings.s3AccessKey")}
        set={model.settings?.s3AccessKeyIdSet ?? false}
        draft={model.s3AccessKeyId}
        onDraft={model.setS3AccessKeyId}
      />
      <AdminSettingsSecretField
        id="settings-s3-secret"
        label={t("admin.settings.s3SecretKey")}
        set={model.settings?.s3SecretAccessKeySet ?? false}
        draft={model.s3SecretAccessKey}
        onDraft={model.setS3SecretAccessKey}
      />
      <AdminSettingsToggle
        id="settings-s3-path"
        label={t("admin.settings.s3ForcePathStyle")}
        checked={model.s3ForcePathStyle}
        onChange={model.setS3ForcePathStyle}
      />
      <Field>
        <FieldLabel htmlFor="settings-s3-public">{t("admin.settings.s3PublicUrl")}</FieldLabel>
        <Input
          id="settings-s3-public"
          value={model.s3PublicUrlBase}
          onChange={(event) => model.setS3PublicUrlBase(event.target.value)}
        />
      </Field>
    </FieldGroup>
  );
}

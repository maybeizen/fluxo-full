import type { AdminSettingsModel } from "@/hooks/use-admin-settings";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsApplicationTab({ model }: { model: AdminSettingsModel }) {
  const {
    AdminSettingsIconUploader,
    AdminSettingsToggle,
    Field,
    FieldDescription,
    FieldGroup,
    FieldLabel,
    Input,
    Textarea,
  } = useUI();
  const t = useT();

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="settings-app-name">{t("admin.settings.appName")}</FieldLabel>
        <Input
          id="settings-app-name"
          value={model.appName}
          onChange={(event) => model.setAppName(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-app-url">{t("admin.settings.appBaseUrl")}</FieldLabel>
        <Input
          id="settings-app-url"
          value={model.appBaseUrl}
          onChange={(event) => model.setAppBaseUrl(event.target.value)}
        />
      </Field>
      <AdminSettingsIconUploader
        iconUrl={model.settings?.appIconUrl}
        busy={model.iconBusy}
        onUpload={model.onUploadIcon}
        onDelete={model.onDeleteIcon}
      />
      <AdminSettingsToggle
        id="settings-tickets"
        label={t("admin.settings.supportTickets")}
        checked={model.appSupportTicketsEnabled}
        onChange={model.setAppSupportTicketsEnabled}
      />
      <AdminSettingsToggle
        id="settings-maintenance"
        label={t("admin.settings.maintenance")}
        description={t("admin.settings.maintenanceHelp")}
        checked={model.appMaintenanceModeEnabled}
        onChange={model.setAppMaintenanceModeEnabled}
      />
      <Field>
        <FieldLabel htmlFor="settings-maintenance-message">
          {t("admin.settings.maintenanceMessage")}
        </FieldLabel>
        <Textarea
          id="settings-maintenance-message"
          value={model.appMaintenanceMessage}
          onChange={(event) => model.setAppMaintenanceMessage(event.target.value)}
        />
      </Field>
      <AdminSettingsToggle
        id="settings-banner"
        label={t("admin.settings.banner")}
        checked={model.appGlobalBannerAnnouncementEnabled}
        onChange={model.setAppGlobalBannerAnnouncementEnabled}
      />
      <Field>
        <FieldLabel htmlFor="settings-banner-message">{t("admin.settings.bannerMessage")}</FieldLabel>
        <Textarea
          id="settings-banner-message"
          value={model.appGlobalBannerAnnouncementMessage}
          onChange={(event) => model.setAppGlobalBannerAnnouncementMessage(event.target.value)}
        />
      </Field>
      <AdminSettingsToggle
        id="settings-debug"
        label={t("admin.settings.debug")}
        description={t("admin.settings.debugHelp")}
        checked={model.appDebugMode}
        onChange={model.setAppDebugMode}
      />
      <FieldDescription>{t("admin.settings.applicationHelp")}</FieldDescription>
    </FieldGroup>
  );
}

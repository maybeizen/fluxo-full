import type { AdminSettingsModel } from "@/hooks/use-admin-settings";
import { useT } from "@/theme-system/use-t";
import { useUI } from "@/theme-system/use-ui";

export function AdminSettingsBillingTab({ model }: { model: AdminSettingsModel }) {
  const { AdminSettingsToggle, Field, FieldGroup, FieldLabel, Input, Textarea } = useUI();
  const t = useT();
  return (
    <FieldGroup>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="settings-currency">{t("admin.settings.currency")}</FieldLabel>
          <Input
            id="settings-currency"
            value={model.billingCurrency}
            onChange={(event) => model.setBillingCurrency(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-locale">{t("admin.settings.locale")}</FieldLabel>
          <Input
            id="settings-locale"
            value={model.billingLocale}
            onChange={(event) => model.setBillingLocale(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-timezone">{t("admin.settings.timezone")}</FieldLabel>
          <Input
            id="settings-timezone"
            value={model.billingTimezone}
            onChange={(event) => model.setBillingTimezone(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-invoice-prefix">{t("admin.settings.invoicePrefix")}</FieldLabel>
          <Input
            id="settings-invoice-prefix"
            value={model.billingInvoicePrefix}
            onChange={(event) => model.setBillingInvoicePrefix(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-invoice-due">{t("admin.settings.invoiceDueDays")}</FieldLabel>
          <Input
            id="settings-invoice-due"
            inputMode="numeric"
            value={model.billingInvoiceDueDays}
            onChange={(event) => model.setBillingInvoiceDueDays(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-tax-label">{t("admin.settings.taxLabel")}</FieldLabel>
          <Input
            id="settings-tax-label"
            value={model.billingTaxLabel}
            onChange={(event) => model.setBillingTaxLabel(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="settings-tax-rate">{t("admin.settings.taxRate")}</FieldLabel>
          <Input
            id="settings-tax-rate"
            inputMode="decimal"
            value={model.billingTaxRate}
            onChange={(event) => model.setBillingTaxRate(event.target.value)}
          />
        </Field>
      </div>
      <AdminSettingsToggle
        id="settings-tax-enabled"
        label={t("admin.settings.taxEnabled")}
        checked={model.billingTaxEnabled}
        onChange={model.setBillingTaxEnabled}
      />
      <AdminSettingsToggle
        id="settings-tax-inclusive"
        label={t("admin.settings.taxInclusive")}
        checked={model.billingTaxInclusive}
        onChange={model.setBillingTaxInclusive}
      />
      <Field>
        <FieldLabel htmlFor="settings-company">{t("admin.settings.companyName")}</FieldLabel>
        <Input
          id="settings-company"
          value={model.billingCompanyName}
          onChange={(event) => model.setBillingCompanyName(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-company-address">{t("admin.settings.companyAddress")}</FieldLabel>
        <Textarea
          id="settings-company-address"
          value={model.billingCompanyAddress}
          onChange={(event) => model.setBillingCompanyAddress(event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="settings-support-email">{t("admin.settings.supportEmail")}</FieldLabel>
        <Input
          id="settings-support-email"
          type="email"
          value={model.billingSupportEmail}
          onChange={(event) => model.setBillingSupportEmail(event.target.value)}
        />
      </Field>
    </FieldGroup>
  );
}

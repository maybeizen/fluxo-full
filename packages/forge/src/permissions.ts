export const PLUGIN_PERMISSIONS = [
  "config.read",
  "config.write",
  "storage.read",
  "storage.write",
  "http.outbound",
  "events.subscribe",
  "events.emit",
  "jobs.schedule",
  "webhooks.receive",
  "users.read",
  "settings.read",
  "service.provision",
  "service.power",
  "service.suspend",
  "billing.checkout",
  "billing.refund",
  "billing.webhook",
] as const;

export type PluginPermission = (typeof PLUGIN_PERMISSIONS)[number];

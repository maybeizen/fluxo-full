import type {
  PluginContext,
  PluginId,
  PluginLogger,
} from "@fluxo/forge";

export function createFakeLogger(): PluginLogger {
  const logger: PluginLogger = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => logger,
  };
  return logger;
}

export function createFakePluginContext(
  pluginId: PluginId,
  logger: PluginLogger = createFakeLogger(),
): PluginContext {
  return {
    pluginId,
    logger: logger.child({ plugin: pluginId }),
    config: {
      get: () => undefined,
      getSecret: () => undefined,
      all: () => ({}),
    },
    storage: {
      get: async () => undefined,
      set: async () => undefined,
      delete: async () => undefined,
      keys: async () => [],
    },
    events: {
      on: () => () => undefined,
      onCustom: () => () => undefined,
      emitCustom: async () => undefined,
    },
    jobs: {
      schedule: async () => ({ jobId: "job" }),
      cancel: async () => undefined,
    },
    http: {
      request: async () => ({ status: 200, headers: {}, body: {} }),
    },
    users: {
      getById: async () => null,
    },
    settings: {
      getPublic: async () => ({
        appName: "Fluxo",
        appBaseUrl: "http://localhost:5173",
        billingCurrency: "USD",
        billingLocale: "en-US",
        billingTimezone: "UTC",
      }),
    },
  };
}

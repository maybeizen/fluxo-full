import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { JsonValue, PluginConfigField } from "@fluxo/forge";
import { AuthApiError } from "@/lib/auth";
import { t } from "@/theme-system/use-t";
import {
  adminPluginConfigQueryKey,
  adminPluginInstanceConfigQueryKey,
  adminPluginInstancesQueryKey,
  adminPluginQueryKey,
  adminPluginsQueryKey,
  checkAdminPluginHealth,
  createAdminPluginInstance,
  deleteAdminPluginInstance,
  disableAdminPlugin,
  enableAdminPlugin,
  getAdminPlugin,
  getAdminPluginConfig,
  getAdminPluginInstanceConfig,
  listAdminPluginInstances,
  putAdminPluginConfig,
  putAdminPluginInstanceConfig,
  setAdminPluginInstanceEnabled,
  uninstallAdminPlugin,
} from "./api";
import type { PluginHealthSnapshot, PluginSecretDraft } from "./types";
import {
  buildConfigPayload,
  validatePluginConfigDraft,
} from "./validate-config";

function emptySecret(): PluginSecretDraft {
  return { value: "", clear: false };
}

function defaultValue(field: PluginConfigField): JsonValue | undefined {
  if (field.type === "secret") {
    return undefined;
  }
  if ("default" in field && field.default !== undefined) {
    return field.default as JsonValue;
  }
  if (field.type === "boolean") {
    return false;
  }
  if (field.type === "multiselect") {
    return [];
  }
  if (field.type === "number") {
    return undefined;
  }
  return "";
}

function hydrateValues(
  schema: readonly PluginConfigField[],
  stored: Record<string, JsonValue>,
): Record<string, JsonValue | undefined> {
  const next: Record<string, JsonValue | undefined> = {};
  for (const field of schema) {
    if (field.type === "secret") {
      continue;
    }
    next[field.key] = Object.hasOwn(stored, field.key)
      ? stored[field.key]
      : defaultValue(field);
  }
  return next;
}

function hydrateSecrets(
  schema: readonly PluginConfigField[],
): Record<string, PluginSecretDraft> {
  const next: Record<string, PluginSecretDraft> = {};
  for (const field of schema) {
    if (field.type === "secret") {
      next[field.key] = emptySecret();
    }
  }
  return next;
}

function mapDraftErrors(
  schema: readonly PluginConfigField[],
  values: Record<string, JsonValue | undefined>,
  secrets: Record<string, PluginSecretDraft>,
  secretKeysSet: readonly string[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const error of validatePluginConfigDraft(
    schema,
    values,
    secrets,
    secretKeysSet,
  )) {
    errors[error.key] = t(`admin.plugins.validation.${error.code}`, {
      label: error.label,
    });
  }
  return errors;
}

export function useAdminPlugin(pluginId: string) {
  const queryClient = useQueryClient();
  const pluginQuery = useQuery({
    queryKey: adminPluginQueryKey(pluginId),
    queryFn: () => getAdminPlugin(pluginId),
    enabled: pluginId.length > 0,
  });
  const configQuery = useQuery({
    queryKey: adminPluginConfigQueryKey(pluginId),
    queryFn: () => getAdminPluginConfig(pluginId),
    enabled: pluginId.length > 0,
  });
  const instancesQuery = useQuery({
    queryKey: adminPluginInstancesQueryKey(pluginId),
    queryFn: () => listAdminPluginInstances(pluginId),
    enabled: pluginId.length > 0,
  });

  const plugin = pluginQuery.data;
  const supportsInstances =
    plugin?.type === "service" || plugin?.type === "gateway";

  const [values, setValues] = useState<Record<string, JsonValue | undefined>>(
    {},
  );
  const [secrets, setSecrets] = useState<Record<string, PluginSecretDraft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | undefined>();
  const [selectedInstanceId, setSelectedInstanceId] = useState<
    string | undefined
  >();
  const [instanceValues, setInstanceValues] = useState<
    Record<string, JsonValue | undefined>
  >({});
  const [instanceSecrets, setInstanceSecrets] = useState<
    Record<string, PluginSecretDraft>
  >({});
  const [instanceErrors, setInstanceErrors] = useState<Record<string, string>>(
    {},
  );
  const [instanceFormError, setInstanceFormError] = useState<
    string | undefined
  >();
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEnabled, setCreateEnabled] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();
  const [uninstallOpen, setUninstallOpen] = useState(false);
  const [purgeStorage, setPurgeStorage] = useState(false);
  const [health, setHealth] = useState<PluginHealthSnapshot | undefined>();

  const instanceConfigQuery = useQuery({
    queryKey: adminPluginInstanceConfigQueryKey(
      pluginId,
      selectedInstanceId ?? "",
    ),
    queryFn: () =>
      getAdminPluginInstanceConfig(pluginId, selectedInstanceId ?? ""),
    enabled: Boolean(selectedInstanceId),
  });

  useEffect(() => {
    const config = configQuery.data;
    if (!config) {
      return;
    }
    setValues(hydrateValues(config.schema, config.values));
    setSecrets(hydrateSecrets(config.schema));
    setErrors({});
    setFormError(undefined);
  }, [configQuery.data]);

  useEffect(() => {
    const config = instanceConfigQuery.data;
    if (!config || !selectedInstanceId) {
      return;
    }
    setInstanceValues(hydrateValues(config.schema, config.values));
    setInstanceSecrets(hydrateSecrets(config.schema));
    setInstanceErrors({});
    setInstanceFormError(undefined);
  }, [instanceConfigQuery.data, selectedInstanceId]);

  async function invalidateAll(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: adminPluginsQueryKey });
    await queryClient.invalidateQueries({
      queryKey: adminPluginQueryKey(pluginId),
    });
    await queryClient.invalidateQueries({
      queryKey: adminPluginConfigQueryKey(pluginId),
    });
    await queryClient.invalidateQueries({
      queryKey: adminPluginInstancesQueryKey(pluginId),
    });
    if (selectedInstanceId) {
      await queryClient.invalidateQueries({
        queryKey: adminPluginInstanceConfigQueryKey(
          pluginId,
          selectedInstanceId,
        ),
      });
    }
  }

  const enableMutation = useMutation({
    mutationFn: () => enableAdminPlugin(pluginId),
    onSuccess: async () => {
      await invalidateAll();
      toast.success(t("admin.plugins.enabled"));
    },
    onError: (error) => {
      toast.error(
        error instanceof AuthApiError
          ? error.message
          : t("admin.plugins.unable.enable"),
      );
    },
  });

  const disableMutation = useMutation({
    mutationFn: () => disableAdminPlugin(pluginId),
    onSuccess: async () => {
      await invalidateAll();
      toast.success(t("admin.plugins.disabled"));
    },
    onError: (error) => {
      toast.error(
        error instanceof AuthApiError
          ? error.message
          : t("admin.plugins.unable.disable"),
      );
    },
  });

  const uninstallMutation = useMutation({
    mutationFn: () => uninstallAdminPlugin(pluginId, { purgeStorage }),
    onSuccess: async () => {
      setUninstallOpen(false);
      await queryClient.invalidateQueries({ queryKey: adminPluginsQueryKey });
      toast.success(t("admin.plugins.uninstalled"));
    },
    onError: (error) => {
      toast.error(
        error instanceof AuthApiError
          ? error.message
          : t("admin.plugins.unable.uninstall"),
      );
    },
  });

  const healthMutation = useMutation({
    mutationFn: () => checkAdminPluginHealth(pluginId),
    onSuccess: (snapshot) => {
      setHealth(snapshot);
    },
    onError: (error) => {
      toast.error(
        error instanceof AuthApiError
          ? error.message
          : t("admin.plugins.unable.health"),
      );
    },
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, JsonValue | null>) =>
      putAdminPluginConfig(pluginId, payload),
    onSuccess: async (config) => {
      await invalidateAll();
      setValues(hydrateValues(config.schema, config.values));
      setSecrets(hydrateSecrets(config.schema));
      setErrors({});
      setFormError(undefined);
      toast.success(t("admin.plugins.detail.saved"));
    },
    onError: (error) => {
      const message =
        error instanceof AuthApiError
          ? error.message
          : t("admin.plugins.unable.save");
      setFormError(message);
      toast.error(message);
    },
  });

  const saveInstanceMutation = useMutation({
    mutationFn: (payload: Record<string, JsonValue | null>) =>
      putAdminPluginInstanceConfig(pluginId, selectedInstanceId ?? "", payload),
    onSuccess: async (config) => {
      await invalidateAll();
      setInstanceValues(hydrateValues(config.schema, config.values));
      setInstanceSecrets(hydrateSecrets(config.schema));
      setInstanceErrors({});
      setInstanceFormError(undefined);
      toast.success(t("admin.plugins.detail.saved"));
    },
    onError: (error) => {
      const message =
        error instanceof AuthApiError
          ? error.message
          : t("admin.plugins.unable.save");
      setInstanceFormError(message);
      toast.error(message);
    },
  });

  const createInstanceMutation = useMutation({
    mutationFn: () =>
      createAdminPluginInstance(pluginId, {
        displayName: createName.trim(),
        enabled: createEnabled,
      }),
    onSuccess: async (instance) => {
      setCreateOpen(false);
      setCreateName("");
      setCreateEnabled(false);
      setCreateError(undefined);
      setSelectedInstanceId(instance.id);
      await invalidateAll();
      toast.success(t("admin.plugins.instances.created"));
    },
    onError: (error) => {
      const message =
        error instanceof AuthApiError
          ? error.message
          : t("admin.plugins.unable.instance");
      setCreateError(message);
      toast.error(message);
    },
  });

  const instanceEnabledMutation = useMutation({
    mutationFn: (input: { instanceId: string; enabled: boolean }) =>
      setAdminPluginInstanceEnabled(pluginId, input.instanceId, input.enabled),
    onSuccess: async () => {
      await invalidateAll();
    },
    onError: (error) => {
      toast.error(
        error instanceof AuthApiError
          ? error.message
          : t("admin.plugins.unable.instance"),
      );
    },
  });

  const deleteInstanceMutation = useMutation({
    mutationFn: (instanceId: string) =>
      deleteAdminPluginInstance(pluginId, instanceId),
    onSuccess: async (_result, instanceId) => {
      if (selectedInstanceId === instanceId) {
        setSelectedInstanceId(undefined);
      }
      await invalidateAll();
    },
    onError: (error) => {
      toast.error(
        error instanceof AuthApiError
          ? error.message
          : t("admin.plugins.unable.instance"),
      );
    },
  });

  const pluginConfig = configQuery.data;
  const instanceConfig = instanceConfigQuery.data;

  const pluginConfigForm = useMemo(
    () => ({
      schema: pluginConfig?.schema ?? [],
      values,
      secrets,
      secretKeysSet: pluginConfig?.secretKeysSet ?? [],
      errors,
      formError,
      pending: saveMutation.isPending,
      onValue: (key: string, value: JsonValue) => {
        setValues((current) => ({ ...current, [key]: value }));
      },
      onSecret: (key: string, draft: PluginSecretDraft) => {
        setSecrets((current) => ({ ...current, [key]: draft }));
      },
      onSubmit: (event: FormEvent) => {
        event.preventDefault();
        if (!pluginConfig) {
          return;
        }
        const nextErrors = mapDraftErrors(
          pluginConfig.schema,
          values,
          secrets,
          pluginConfig.secretKeysSet,
        );
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
          return;
        }
        saveMutation.mutate(
          buildConfigPayload(pluginConfig.schema, values, secrets),
        );
      },
    }),
    [pluginConfig, values, secrets, errors, formError, saveMutation],
  );

  const instanceConfigForm = useMemo(
    () => ({
      schema: instanceConfig?.schema ?? [],
      values: instanceValues,
      secrets: instanceSecrets,
      secretKeysSet: instanceConfig?.secretKeysSet ?? [],
      errors: instanceErrors,
      formError: instanceFormError,
      pending: saveInstanceMutation.isPending,
      onValue: (key: string, value: JsonValue) => {
        setInstanceValues((current) => ({ ...current, [key]: value }));
      },
      onSecret: (key: string, draft: PluginSecretDraft) => {
        setInstanceSecrets((current) => ({ ...current, [key]: draft }));
      },
      onSubmit: (event: FormEvent) => {
        event.preventDefault();
        if (!instanceConfig || !selectedInstanceId) {
          return;
        }
        const nextErrors = mapDraftErrors(
          instanceConfig.schema,
          instanceValues,
          instanceSecrets,
          instanceConfig.secretKeysSet,
        );
        setInstanceErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
          return;
        }
        saveInstanceMutation.mutate(
          buildConfigPayload(
            instanceConfig.schema,
            instanceValues,
            instanceSecrets,
          ),
        );
      },
    }),
    [
      instanceConfig,
      instanceValues,
      instanceSecrets,
      instanceErrors,
      instanceFormError,
      saveInstanceMutation,
      selectedInstanceId,
    ],
  );

  return {
    pluginId,
    plugin,
    isPending: pluginQuery.isPending,
    isError: pluginQuery.isError,
    supportsInstances,
    instances: instancesQuery.data ?? [],
    instancesPending: instancesQuery.isPending,
    selectedInstanceId,
    setSelectedInstanceId,
    pluginConfigForm,
    instanceConfigForm,
    instanceConfigPending: instanceConfigQuery.isPending,
    health,
    healthPending: healthMutation.isPending,
    onHealth: () => healthMutation.mutate(),
    enablePending: enableMutation.isPending,
    disablePending: disableMutation.isPending,
    onEnable: () => enableMutation.mutate(),
    onDisable: () => disableMutation.mutate(),
    uninstallOpen,
    setUninstallOpen,
    purgeStorage,
    setPurgeStorage,
    uninstallPending: uninstallMutation.isPending,
    onUninstall: () => uninstallMutation.mutate(),
    createOpen,
    setCreateOpen,
    createName,
    setCreateName,
    createEnabled,
    setCreateEnabled,
    createError,
    createPending: createInstanceMutation.isPending,
    onCreateInstance: (event: FormEvent) => {
      event.preventDefault();
      if (createName.trim().length === 0) {
        setCreateError(t("admin.plugins.instances.nameRequired"));
        return;
      }
      createInstanceMutation.mutate();
    },
    instanceActionPending:
      instanceEnabledMutation.isPending || deleteInstanceMutation.isPending,
    onSetInstanceEnabled: (instanceId: string, enabled: boolean) => {
      instanceEnabledMutation.mutate({ instanceId, enabled });
    },
    onDeleteInstance: (instanceId: string) => {
      deleteInstanceMutation.mutate(instanceId);
    },
  };
}

export type AdminPluginModel = ReturnType<typeof useAdminPlugin>;
export type AdminPluginConfigFormModel = AdminPluginModel["pluginConfigForm"];

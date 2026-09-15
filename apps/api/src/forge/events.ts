import {
  FORGE_EVENT_NAMES,
  ForgePermissionError,
  ForgeValidationError,
  assertNoPrototypePollution,
  jsonValueSchema,
  qualifyEventName,
  type ForgeEventHandler,
  type ForgeEventMap,
  type ForgeEventName,
  type JsonValue,
  type PluginEvents,
  type PluginId,
  type PluginLogger,
  type PluginPermission,
} from "@fluxo/forge";

const CORE_EVENTS = new Set<string>(FORGE_EVENT_NAMES);
const CUSTOM_NAME_PATTERN = /^[a-z][a-z0-9_.-]{0,63}$/;

type AnyHandler = (payload: unknown) => Promise<void> | void;

export interface ForgeEventBus {
  on<K extends ForgeEventName>(event: K, handler: ForgeEventHandler<K>): () => void;
  onCustom(name: string, handler: (payload: JsonValue) => Promise<void> | void): () => void;
  emit<K extends ForgeEventName>(event: K, payload: ForgeEventMap[K]): Promise<void>;
  emitCustom(name: string, payload: JsonValue): Promise<void>;
}

export interface CreatePluginEventsOptions {
  pluginId: PluginId;
  permissions: readonly PluginPermission[];
  bus: ForgeEventBus;
}

let activeBus: ForgeEventBus | undefined;

export function createForgeEventBus(logger?: PluginLogger): ForgeEventBus {
  const listeners = new Map<string, Set<AnyHandler>>();

  function subscribe(name: string, handler: AnyHandler): () => void {
    const set = listeners.get(name) ?? new Set<AnyHandler>();
    set.add(handler);
    listeners.set(name, set);
    return () => {
      const current = listeners.get(name);
      current?.delete(handler);
      if (current && current.size === 0) {
        listeners.delete(name);
      }
    };
  }

  async function dispatch(name: string, payload: unknown): Promise<void> {
    const set = listeners.get(name);
    if (!set || set.size === 0) {
      return;
    }
    for (const handler of [...set]) {
      try {
        await handler(payload);
      } catch (error) {
        logger?.error("plugin event listener failed", {
          event: name,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  return {
    on(event, handler) {
      assertCoreEvent(event);
      return subscribe(event, handler as AnyHandler);
    },
    onCustom(name, handler) {
      return subscribe(name, handler as AnyHandler);
    },
    emit(event, payload) {
      assertCoreEvent(event);
      return dispatch(event, payload);
    },
    emitCustom(name, payload) {
      return dispatch(name, payload);
    },
  };
}

export function setActiveForgeEventBus(bus: ForgeEventBus | undefined): void {
  activeBus = bus;
}

export function getActiveForgeEventBus(): ForgeEventBus | undefined {
  return activeBus;
}

export async function emitForgeEvent<K extends ForgeEventName>(
  event: K,
  payload: ForgeEventMap[K],
): Promise<void> {
  await activeBus?.emit(event, payload);
}

export function createPluginEvents(options: CreatePluginEventsOptions): PluginEvents {
  const permissions = new Set(options.permissions);
  return {
    on(event, handler) {
      requireSubscribe(permissions);
      assertCoreEvent(event);
      return options.bus.on(event, handler);
    },
    onCustom(name, handler) {
      requireSubscribe(permissions);
      const qualified = qualifyCustomName(options.pluginId, name);
      return options.bus.onCustom(qualified, handler);
    },
    async emitCustom(name, payload) {
      if (!permissions.has("events.emit")) {
        throw new ForgePermissionError("events.emit");
      }
      const qualified = qualifyCustomName(options.pluginId, name);
      const parsed = parsePayload(payload);
      await options.bus.emitCustom(qualified, parsed);
    },
  };
}

function requireSubscribe(permissions: ReadonlySet<string>): void {
  if (!permissions.has("events.subscribe")) {
    throw new ForgePermissionError("events.subscribe");
  }
}

function assertCoreEvent(event: string): asserts event is ForgeEventName {
  if (!CORE_EVENTS.has(event)) {
    throw new ForgeValidationError("Unknown forge event");
  }
}

function qualifyCustomName(pluginId: PluginId, name: string): string {
  if (!CUSTOM_NAME_PATTERN.test(name) || CORE_EVENTS.has(name)) {
    throw new ForgeValidationError("Invalid custom event name");
  }
  return qualifyEventName(pluginId, name);
}

function parsePayload(payload: JsonValue): JsonValue {
  assertNoPrototypePollution(payload);
  const parsed = jsonValueSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ForgeValidationError("Invalid event payload");
  }
  return parsed.data;
}

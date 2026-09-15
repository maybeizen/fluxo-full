import {
  REDACTED,
  SENSITIVE_HEADER_NAMES,
  type PluginLogger,
} from "@fluxo/forge";

const SENSITIVE_HEADER_SET = new Set<string>(SENSITIVE_HEADER_NAMES);

const SENSITIVE_KEY_PATTERN =
  /pass(word|wd)|secret|token|authorization|cookie|api[_-]?key|private[_-]?key|credential|bearer/i;

export interface CreatePluginLoggerOptions {
  logger: PluginLogger;
  pluginId: string;
  pluginVersion: string;
  instanceId?: string;
  requestId?: string;
  operationId?: string;
  secrets?: readonly string[];
}

export function createPluginLogger(options: CreatePluginLoggerOptions): PluginLogger {
  const secrets = new Set(options.secrets?.filter((value) => value.length > 0) ?? []);
  const bindings: Record<string, unknown> = {
    pluginId: options.pluginId,
    pluginVersion: options.pluginVersion,
  };
  if (options.instanceId !== undefined) {
    bindings.instanceId = options.instanceId;
  }
  if (options.requestId !== undefined) {
    bindings.requestId = options.requestId;
  }
  if (options.operationId !== undefined) {
    bindings.operationId = options.operationId;
  }
  return wrapLogger(options.logger.child(bindings), secrets);
}

export function redactLogValue(value: unknown, secrets: ReadonlySet<string> = new Set()): unknown {
  return redactUnknown(value, secrets, 0);
}

function wrapLogger(logger: PluginLogger, secrets: ReadonlySet<string>): PluginLogger {
  const wrapped: PluginLogger = {
    debug(message, meta) {
      logger.debug(message, meta === undefined ? undefined : redactRecord(meta, secrets));
    },
    info(message, meta) {
      logger.info(message, meta === undefined ? undefined : redactRecord(meta, secrets));
    },
    warn(message, meta) {
      logger.warn(message, meta === undefined ? undefined : redactRecord(meta, secrets));
    },
    error(message, meta) {
      logger.error(message, meta === undefined ? undefined : redactRecord(meta, secrets));
    },
    child(childBindings) {
      return wrapLogger(logger.child(redactRecord(childBindings, secrets)), secrets);
    },
  };
  return wrapped;
}

function redactRecord(
  meta: Record<string, unknown>,
  secrets: ReadonlySet<string>,
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    redacted[key] = isSensitiveKey(key) ? REDACTED : redactUnknown(value, secrets, 0);
  }
  return redacted;
}

function redactUnknown(value: unknown, secrets: ReadonlySet<string>, depth: number): unknown {
  if (depth > 8) {
    return REDACTED;
  }
  if (typeof value === "string") {
    return redactString(value, secrets);
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactUnknown(item, secrets, depth + 1));
  }
  const record = value as Record<string, unknown>;
  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(record)) {
    redacted[key] = isSensitiveKey(key) ? REDACTED : redactUnknown(entry, secrets, depth + 1);
  }
  return redacted;
}

function redactString(value: string, secrets: ReadonlySet<string>): string {
  if (secrets.has(value)) {
    return REDACTED;
  }
  let next = value;
  for (const secret of secrets) {
    if (secret.length > 0 && next.includes(secret)) {
      next = next.split(secret).join(REDACTED);
    }
  }
  return next;
}

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_HEADER_SET.has(key.toLowerCase()) || SENSITIVE_KEY_PATTERN.test(key);
}

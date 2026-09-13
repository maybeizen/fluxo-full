import type { LogLevel } from "@fluxo/types";

export interface CreateLoggerOptions {
  service: string;
  level?: LogLevel;
  directory?: string;
}

export interface FluxoLogger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): FluxoLogger;
}

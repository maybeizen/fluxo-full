import { mkdirSync } from "node:fs";
import path from "node:path";
import { LogLevel } from "@fluxo/types";
import chalk from "chalk";
import winston from "winston";
import type { CreateLoggerOptions, FluxoLogger } from "./types.js";

const reserved = new Set(["level", "message", "service", "timestamp", "splat"]);

function colorFor(level: string): (text: string) => string {
  switch (level) {
    case LogLevel.Error:
      return chalk.red;
    case LogLevel.Warn:
      return chalk.yellow;
    case LogLevel.Info:
      return chalk.green;
    default:
      return chalk.gray;
  }
}

function wrap(logger: winston.Logger): FluxoLogger {
  return {
    debug(message, meta) {
      logger.debug(message, meta);
    },
    info(message, meta) {
      logger.info(message, meta);
    },
    warn(message, meta) {
      logger.warn(message, meta);
    },
    error(message, meta) {
      logger.error(message, meta);
    },
    child(bindings) {
      return wrap(logger.child(bindings));
    },
  };
}

export function createLogger(options: CreateLoggerOptions): FluxoLogger {
  const level = options.level ?? LogLevel.Info;

  const consoleTransport = new winston.transports.Console({
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const extras = Object.entries(info)
          .filter(([key]) => !reserved.has(key))
          .reduce<Record<string, unknown>>((acc, [key, value]) => {
            acc[key] = value;
            return acc;
          }, {});
        const suffix = Object.keys(extras).length > 0 ? ` ${JSON.stringify(extras)}` : "";
        const line = `${String(info.timestamp)} [${info.level}] ${options.service}: ${String(info.message)}${suffix}`;
        return colorFor(info.level)(line);
      }),
    ),
  });

  const transports: winston.transport[] = [consoleTransport];

  if (options.directory !== undefined) {
    mkdirSync(options.directory, { recursive: true });
    transports.unshift(
      new winston.transports.File({
        filename: path.join(options.directory, `${options.service}.log`),
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      }),
    );
  }

  const logger = winston.createLogger({
    level,
    defaultMeta: { service: options.service },
    transports,
  });

  return wrap(logger);
}

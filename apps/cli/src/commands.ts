import { homedir } from "node:os";
import path from "node:path";
import { createLogger } from "@fluxo/logger";
import { defineCommand } from "citty";
import { runHealth } from "./health.js";
import {
  handleSettingsGet,
  handleSettingsList,
  handleSettingsSet,
  resolveSettingsPath,
} from "./settings.js";
import { handleUserRole, updateUserRole } from "./user-role.js";

function cliLogger() {
  return createLogger({
    service: "cli",
    directory: path.join(homedir(), ".fluxo", "logs"),
  });
}

export const healthCommand = defineCommand({
  meta: {
    name: "health",
    description: "Check local process and optional API health",
  },
  async run() {
    await runHealth({ logger: cliLogger() });
  },
});

export const settingsListCommand = defineCommand({
  meta: {
    name: "list",
    description: "List all settings",
  },
  async run() {
    await handleSettingsList(cliLogger(), resolveSettingsPath());
  },
});

export const settingsGetCommand = defineCommand({
  meta: {
    name: "get",
    description: "Get a setting by key",
  },
  args: {
    key: { type: "positional", required: true, description: "Setting key" },
  },
  async run({ args }) {
    await handleSettingsGet(cliLogger(), resolveSettingsPath(), String(args.key));
  },
});

export const settingsSetCommand = defineCommand({
  meta: {
    name: "set",
    description: "Set a setting value",
  },
  args: {
    key: { type: "positional", required: true, description: "Setting key" },
    value: { type: "positional", required: true, description: "Setting value" },
  },
  async run({ args }) {
    await handleSettingsSet(cliLogger(), resolveSettingsPath(), String(args.key), String(args.value));
  },
});

export const settingsCommand = defineCommand({
  meta: {
    name: "settings",
    description: "Read and write local Fluxo settings",
  },
  subCommands: {
    list: settingsListCommand,
    get: settingsGetCommand,
    set: settingsSetCommand,
  },
});

export const userRoleCommand = defineCommand({
  meta: {
    name: "role",
    description: "Set a user's role (user or admin)",
  },
  args: {
    user: { type: "positional", required: false, description: "Username or email" },
    role: { type: "positional", required: false, description: "Role: user or admin" },
  },
  async run({ args }) {
    const result = await handleUserRole({
      logger: cliLogger(),
      user: args.user ? String(args.user) : undefined,
      role: args.role ? String(args.role) : undefined,
      updateRole: (user, role) => updateUserRole(user, role),
    });
    if (result.status === "error") {
      process.exitCode = 1;
    }
  },
});

export const userCommand = defineCommand({
  meta: {
    name: "user",
    description: "Manage Fluxo users",
  },
  subCommands: {
    role: userRoleCommand,
  },
});

export const main = defineCommand({
  meta: {
    name: "fluxo",
    description: "Fluxo CLI",
  },
  subCommands: {
    health: healthCommand,
    settings: settingsCommand,
    user: userCommand,
  },
});

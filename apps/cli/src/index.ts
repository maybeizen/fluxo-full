#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { runMain } from "citty";
import { main } from "./commands.js";

const rootEnvPath = path.resolve(import.meta.dirname, "../../../.env");
if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

void runMain(main);

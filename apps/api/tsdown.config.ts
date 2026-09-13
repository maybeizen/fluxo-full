import { defineConfig } from "tsdown";

const watch = process.argv.includes("--watch");

export default defineConfig({
  entry: "src/index.ts",
  dts: true,
  format: ["esm"],
  clean: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  onSuccess: watch ? "node dist/index.js" : undefined,
});

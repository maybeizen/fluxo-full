import { defineConfig } from "vitest/config";

export const nodeVitestConfig = defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
  },
});

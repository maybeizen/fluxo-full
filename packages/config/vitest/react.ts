import { defineConfig } from "vitest/config";

export const reactVitestConfig = defineConfig({
  test: {
    environment: "jsdom",
    passWithNoTests: true,
  },
});

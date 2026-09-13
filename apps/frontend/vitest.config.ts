import { mergeConfig } from "vitest/config";
import { reactVitestConfig } from "@fluxo/config/vitest/react";
import viteConfig from "./vite.config.ts";

export default mergeConfig(viteConfig, {
  ...reactVitestConfig,
  test: {
    ...reactVitestConfig.test,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    passWithNoTests: false,
  },
});

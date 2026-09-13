import { defineConfig } from "eslint/config";
import reactConfig from "@fluxo/config/eslint/react";

export default defineConfig([
  ...reactConfig,
  {
    ignores: ["src/routeTree.gen.ts"],
  },
]);

import { defineConfig, globalIgnores } from "eslint/config";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default defineConfig([
  globalIgnores([
    "**/dist/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/.vite/**",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  prettier,
]);

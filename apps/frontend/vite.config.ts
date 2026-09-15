import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const workspaceRoot = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  envDir: workspaceRoot,
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
  optimizeDeps: {
    exclude: ["@fluxo/types", "@fluxo/forge"],
  },
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@fluxo/types": path.resolve(
        workspaceRoot,
        "packages/types/src/index.ts",
      ),
      "@fluxo/forge": path.resolve(
        workspaceRoot,
        "packages/forge/src/index.ts",
      ),
    },
  },
});

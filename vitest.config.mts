import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      "@messages": fromRoot("./messages"),
      // The real package throws outside React Server Components; tests run server modules directly.
      "server-only": fromRoot("./tests/utils/server-only-stub.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
    unstubEnvs: true,
    server: {
      deps: {
        // next-intl imports "next/navigation" without an extension, which strict
        // Node ESM resolution rejects; letting Vite transform it resolves the path.
        inline: ["next-intl"],
      },
    },
  },
});

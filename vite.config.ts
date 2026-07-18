import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": `${process.cwd()}/src`,
    },
    // Avoid duplicate copies of React/Query in the bundle.
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Use src/server.ts as the SSR server entry (our error-handling wrapper).
      server: { entry: "server" },
      // Stop client bundles from importing server-only code (secret-key
      // Supabase client, admin session cookies, rate limiter). Files under
      // src/server/** are createServerFn wrapper modules meant to be
      // imported by routes/components — only the *.server.ts naming
      // convention (src/lib/*.server.ts) holds the actual server-only logic.
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/*.server.ts"],
          specifiers: ["server-only"],
        },
      },
    }),
    // Build the server output with Nitro (defaults to a Node server preset).
    nitro(),
    viteReact(),
  ],
});

// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Force-enable nitro with a Node target so self-hosted builds (docker, VPS) produce
  // a standalone Node HTTP server at .output/server/index.mjs. Inside a Lovable
  // sandbox the wrapper hard-pins Cloudflare regardless of this option.
  nitro: { preset: "node-server" },
  vite: {
    server: {
      allowedHosts: [
        "localhost",
        ".localhost",
        "meona-exe-03-wsl",
      ],
      proxy: {
        "/api": {
          target: "http://localhost:8000",
          changeOrigin: true,
          // No rewrite needed - backend has /api prefix after merging PR #4
        },
      },
    },
  },
});

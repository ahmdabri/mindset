import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    server: {
      host: "0.0.0.0",
      port: 8080,
      allowedHosts: true,
    },
  },
  tanstackStart: {
    server: { entry: "server" },
  },
});

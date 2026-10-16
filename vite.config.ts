import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { createApiHandler, type ProxyEnv } from "./server/proxy.ts";

function apiProxy(env: ProxyEnv): Plugin {
  const handler = createApiHandler(env);
  return {
    name: "api-proxy",
    configureServer: (server) => void server.middlewares.use(handler),
    configurePreviewServer: (server) => void server.middlewares.use(handler),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      apiProxy({
        OPENSKY_CLIENT_ID: env.OPENSKY_CLIENT_ID,
        OPENSKY_CLIENT_SECRET: env.OPENSKY_CLIENT_SECRET,
      }),
    ],
    test: {
      environment: "node",
    },
  };
});

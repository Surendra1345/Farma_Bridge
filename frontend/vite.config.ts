import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  // Override with API_PROXY_TARGET in frontend/.env if the backend runs elsewhere.
  const env = loadEnv(mode, ".", "");
  const target = env.API_PROXY_TARGET ?? "http://127.0.0.1:8100";

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      proxy: { "/api": { target, changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, "") } },
    },
  };
});

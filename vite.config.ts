import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(__dirname, "src"),

  server: {
    port: 3000,
    host: "0.0.0.0",
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,

    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (
              id.includes("/react/") ||
              id.includes("/react-dom/") ||
              id.includes("/react-router-dom/") ||
              id.includes("/.pnpm/react@")
            ) {
              return "vendor-react";
            }

            if (id.includes("recharts")) {
              return "vendor-charts";
            }
          }
        },
      },
    },

    chunkSizeWarningLimit: 800,
  },
});

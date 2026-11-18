import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
    watch: {
      usePolling: true,
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            /node_modules[\\/](react|react-dom|react-router|scheduler)/.test(id)
          )
            return "react-vendor";
        },
      },
    },
  },
});

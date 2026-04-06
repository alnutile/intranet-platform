import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "client",
  define: {
    "process.env": "{}",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@apps": path.resolve(__dirname, "./apps"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3001",
      "/uploads": "http://localhost:3001",
      "/plugin-assets": "http://localhost:3001",
    },
  },
  build: {
    outDir: "../server/public",
    emptyOutDir: true,
  },
});

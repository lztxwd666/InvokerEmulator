import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Tauri expects a fixed port; keep asset paths portable.
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  publicDir: "assets",
  build: {
    target: "es2022",
    outDir: "dist",
    assetsDir: "static",
    sourcemap: false,
  },
});

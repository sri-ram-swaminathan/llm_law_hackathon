import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@fixtures": path.resolve(import.meta.dirname, "../contracts/fixtures"),
    },
  },
  // default fs.deny contains **/.git/**, which would block SDD worktrees that live under .git/
  server: {
    host: "127.0.0.1", port: 20001, strictPort: true,
    fs: { allow: [import.meta.dirname, path.resolve(import.meta.dirname, "../contracts")], deny: [".env", ".env.*", "*.{crt,pem}"] },
  },
  preview: { host: "127.0.0.1", port: 20001 },
  test: { environment: "jsdom", globals: true, exclude: ["e2e/**", "node_modules/**"] },
});

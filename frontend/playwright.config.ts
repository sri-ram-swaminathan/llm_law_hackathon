import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { baseURL: "http://127.0.0.1:20001", trace: "retain-on-failure" },
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:20001",
    reuseExistingServer: true,
    env: { VITE_FIXTURES: "1" },
    timeout: 60_000,
  },
});

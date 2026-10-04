import { defineConfig, devices } from "@playwright/test";

/**
 * Fixture-mode e2e. The dev server is started here on :20011 with VITE_FIXTURES=1 and is never reused:
 * :20001 is the Docker web app (no fixtures) and must not be touched (DESIGN F9).
 * Live-stack specs use their own config (playwright.live.config.ts, T34).
 */
const PORT = 20011;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: { ...devices["Desktop Chrome"], baseURL: `http://127.0.0.1:${PORT}`, trace: "retain-on-failure" },
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    env: { VITE_FIXTURES: "1" },
    timeout: 60_000,
  },
});

import { defineConfig, devices } from "@playwright/test";

/**
 * Local minimal Playwright config.
 *
 * The original config imported `lovable-agent-playwright-config`, which is
 * not installable in this sandbox. This local fallback boots Vite as a
 * webServer and runs the existing e2e specs against it. No backend, auth,
 * or DB interaction is required by the manifest-preview smoke test.
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const HOST = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: BASE_URL,
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --host ${HOST} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});

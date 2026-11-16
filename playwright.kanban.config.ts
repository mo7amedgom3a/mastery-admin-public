import { defineConfig, devices } from "@playwright/test";

// Isolated API-fixture tests; no QA credentials or live data mutations.
export default defineConfig({
  testDir: "./e2e", testMatch: "kanban.spec.ts", workers: 1,
  timeout: 30_000, reporter: "list",
  use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:5175", trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5175", url: "http://127.0.0.1:5175", reuseExistingServer: true },
});

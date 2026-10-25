import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the running dev stack: this app (`npm run dev`, :5173 by default) and the
 * backend behind its `/api` proxy. They sign in with the QA admin account and change real dev data
 * (they give the QA customer access, then revoke it), so never point them at production.
 *
 *   E2E_ADMIN_URL=http://localhost:5173 QA_ADMIN_EMAIL=… QA_CUSTOMER_EMAIL=… QA_LOGIN_KEY=… npm run test:e2e
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_ADMIN_URL ?? "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/admin.json" },
      dependencies: ["setup"],
    },
  ],
});

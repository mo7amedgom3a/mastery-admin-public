import { expect, test as setup } from "@playwright/test";

import { fingerprint, qa } from "./support";

/** Signs in once as the QA admin through the app's own proxy, so the httpOnly session cookies land in the browser state. */
setup("sign in as the QA admin", async ({ page }) => {
  const response = await page.request.post("/api/v1/admin/auth/qa/login", {
    data: { email: qa().admin, key: qa().key },
    headers: fingerprint,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  await page.goto("/");
  await expect(page).not.toHaveURL(/login/);
  await page.context().storageState({ path: "e2e/.auth/admin.json" });
});

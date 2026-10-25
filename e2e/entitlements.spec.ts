import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { cleanupAccess, fingerprint, seedAccess, type SeededAccess } from "./support";

/*
 * Customer access, end to end from the admin side: the QA customer is given a course, then the admin
 * extends it, suspends it (days frozen), reinstates it (days given back) and revokes it, all from the
 * customer page. The API confirms each stored state.
 */

type Entitlement = {
  entitlement_id: string;
  status: string;
  expires_at: string | null;
  suspended_remaining_days: number | null;
};

const DAY = 86_400_000;
let seeded: SeededAccess | undefined;

async function current(api: APIRequestContext): Promise<Entitlement> {
  const response = await api.get(`/api/v1/admin/customers/${seeded!.customerRef}/entitlements`, {
    params: { product_id: seeded!.productId },
    headers: fingerprint,
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const page = (await response.json()) as { items: Entitlement[] };
  expect(page.items.length).toBeGreaterThan(0);
  return page.items[0];
}

/**
 * The seeded access in the "Product access" card (the admin-grants card lists the product too). Rows are
 * newest first, like the API, so an older revoked access to the same product from an earlier run is skipped.
 */
function accessRow(page: Page) {
  return page
    .locator("section.ma-panel")
    .filter({ has: page.getByRole("heading", { name: /^(Product access|الوصول إلى المنتجات)$/ }) })
    .getByRole("row")
    .filter({ hasText: seeded!.title })
    .first();
}

async function act(page: Page, action: RegExp, reasonId: string, confirm: RegExp) {
  await accessRow(page).getByRole("button", { name: action }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator(`#${reasonId}`).fill("e2e check");
  await dialog.getByRole("button", { name: confirm }).click();
  await expect(dialog).toBeHidden();
}

test.describe.serial("admin entitlement controls", () => {
  test.beforeAll(async ({ request }) => {
    seeded = await seedAccess(request);
  });

  test.afterAll(async ({ request }) => {
    await cleanupAccess(request, seeded);
  });

  test("extend, suspend, reinstate and revoke from the customer page", async ({ page, request }) => {
    await page.goto(`/customers/${encodeURIComponent(seeded!.customerRef)}`);
    await expect(accessRow(page)).toBeVisible();

    // Extend by the default 30 days.
    const before = await current(request);
    expect(before.status).toBe("active");
    await act(page, /^(Extend|تمديد)$/, "extend-reason", /^(Extend|تمديد)$/);
    const extended = await current(request);
    const added = new Date(extended.expires_at!).getTime() - new Date(before.expires_at!).getTime();
    expect(Math.round(added / DAY)).toBe(30);

    // Suspend: the days left are frozen.
    const left = Math.ceil((new Date(extended.expires_at!).getTime() - Date.now()) / DAY);
    await act(page, /^(Suspend|إيقاف)$/, "suspend-reason", /^(Suspend|إيقاف)$/);
    const suspended = await current(request);
    expect(suspended.status).toBe("suspended");
    expect(suspended.suspended_remaining_days).toBe(left);
    await expect(accessRow(page)).toContainText(/Suspended|موقوف مؤقتاً/);

    // Reinstate: the frozen days come back from now.
    await act(page, /^(Reinstate|استئناف)$/, "reinstate-reason", /^(Reinstate|استئناف)$/);
    const reinstated = await current(request);
    expect(reinstated.status).toBe("active");
    const restored = Math.round((new Date(reinstated.expires_at!).getTime() - Date.now()) / DAY);
    expect(Math.abs(restored - left)).toBeLessThanOrEqual(1);

    // Revoke: final, and no more actions on the row.
    await act(page, /^(Revoke|سحب)$/, "revoke-reason", /^(Revoke|سحب نهائي)$/);
    expect((await current(request)).status).toBe("revoked");
    await expect(accessRow(page)).toContainText(/Revoked|مسحوب/);
    await expect(accessRow(page).getByRole("button", { name: /^(Suspend|إيقاف|Extend|تمديد)$/ })).toHaveCount(0);
  });

  test("the history shows the admin changes", async ({ page }) => {
    await page.goto(`/customers/${encodeURIComponent(seeded!.customerRef)}`);
    await accessRow(page).getByRole("button", { name: /^(Details|التفاصيل)$/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(/\+30/);
    for (const action of ["extend", "suspend", "reinstate", "revoke"]) {
      await expect(dialog).toContainText(action);
    }
  });
});

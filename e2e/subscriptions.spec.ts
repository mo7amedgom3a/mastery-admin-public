import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { fingerprint, qaCustomerRef, seedSubscription, type SeededSubscription } from "./support";

/*
 * Subscription lifecycle from the admin side: the QA customer gets a monthly subscription, the admin
 * finds it on the customer page, then schedules a cancellation, resumes it, extends it and finally
 * revokes it from the subscription page. The API confirms each stored state, and the plan's access
 * ends with the revoke.
 */

type Subscription = {
  status: string;
  cancel_at_period_end: boolean;
  auto_renew: boolean;
  canceled_at: string | null;
  current_period_end: string;
};

const DAY = 86_400_000;
let seeded: SeededSubscription | undefined;

async function current(api: APIRequestContext): Promise<Subscription> {
  const response = await api.get(`/api/v1/admin/subscriptions/customer-subscriptions/${seeded!.subscriptionId}`, { headers: fingerprint });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as Subscription;
}

/** Opens the action from the page header, fills the reason and confirms in the modal. */
async function act(page: Page, action: RegExp, confirm: RegExp, reason?: string) {
  await page.getByRole("button", { name: action }).first().click();
  const modal = page.locator(".ma-modal");
  if (reason) await modal.locator("textarea").fill(reason);
  await modal.getByRole("button", { name: confirm }).click();
  await expect(modal).toBeHidden();
}

test.describe.serial("admin subscription lifecycle", () => {
  test.beforeAll(async () => {
    seeded = await seedSubscription();
  });

  test.afterAll(async ({ request }) => {
    // Never leave a live subscription behind on the QA customer.
    if (!seeded) return;
    const state = await current(request).catch(() => null);
    if (state && (state.status === "active" || state.status === "past_due")) {
      await request.post(`/api/v1/admin/subscriptions/customer-subscriptions/${seeded.subscriptionId}/revoke`, {
        data: { reason: "e2e cleanup" },
        headers: fingerprint,
      });
    }
  });

  test("the customer page lists the subscription", async ({ page, request }) => {
    const ref = await qaCustomerRef(request);
    await page.goto(`/customers/${ref}`);
    const card = page.locator("section.ma-panel").filter({ has: page.getByRole("heading", { name: /^(Subscriptions|الاشتراكات)$/ }) });
    await expect(card.locator(`a[href="/subscriptions/subscribers/${seeded!.subscriptionId}"]`).first()).toBeVisible();
  });

  test("schedule a cancellation, then resume it", async ({ page, request }) => {
    await page.goto(`/subscriptions/subscribers/${seeded!.subscriptionId}`);

    await act(page, /^(Cancel at period end|إلغاء بنهاية الفترة)$/, /^(Cancel at period end|إلغاء بنهاية الفترة)$/, "e2e: scheduled cancel");
    await expect(page.getByRole("button", { name: /^(Resume|استئناف)$/ })).toBeVisible();
    let state = await current(request);
    expect(state).toMatchObject({ status: "active", cancel_at_period_end: true, auto_renew: false });
    expect(state.canceled_at).not.toBeNull();

    await act(page, /^(Resume|استئناف)$/, /^(Resume|استئناف)$/);
    await expect(page.getByRole("button", { name: /^(Cancel at period end|إلغاء بنهاية الفترة)$/ })).toBeVisible();
    state = await current(request);
    expect(state).toMatchObject({ status: "active", cancel_at_period_end: false, auto_renew: true, canceled_at: null });
  });

  test("extend the current period", async ({ page, request }) => {
    const before = await current(request);
    await page.goto(`/subscriptions/subscribers/${seeded!.subscriptionId}`);
    await page.getByRole("button", { name: /^(Extend|تمديد)$/ }).first().click();
    const modal = page.locator(".ma-modal");
    await modal.getByLabel(/14/).check();
    await modal.locator("textarea").fill("e2e: outage credit");
    await modal.getByRole("button", { name: /^(Extend|تمديد)$/ }).click();
    await expect(modal).toBeHidden();
    const after = await current(request);
    expect(Date.parse(after.current_period_end) - Date.parse(before.current_period_end)).toBe(14 * DAY);
  });

  test("revoke needs a reason and ends access", async ({ page, request }) => {
    await page.goto(`/subscriptions/subscribers/${seeded!.subscriptionId}`);
    await page.getByRole("button", { name: /^(Revoke|سحب)$/ }).first().click();
    const modal = page.locator(".ma-modal");
    const confirm = modal.getByRole("button", { name: /^(Revoke|سحب نهائي)$/ });
    await expect(confirm).toBeDisabled();
    await modal.locator("textarea").fill("e2e: chargeback");
    await confirm.click();
    await expect(modal).toBeHidden();

    expect((await current(request)).status).toBe("canceled");
    await expect(page.getByRole("button", { name: /^(Revoke|سحب)$/ })).toHaveCount(0);
    const ref = await qaCustomerRef(request);
    const access = await request.get("/api/v1/admin/entitlements", {
      params: { customer_ref: ref, source_type: "subscription", limit: 100 },
      headers: fingerprint,
    });
    expect(access.ok(), await access.text()).toBeTruthy();
    const rows = ((await access.json()) as { items: { source_id?: string | null; status: string }[] }).items;
    const mine = rows.filter((row) => row.source_id === seeded!.subscriptionId);
    expect(mine.length).toBeGreaterThan(0);
    for (const row of mine) expect(row.status).toBe("revoked");
  });
});

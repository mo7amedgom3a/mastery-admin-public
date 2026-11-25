import { expect, test, type APIRequestContext } from "@playwright/test";

import { fingerprint, qa } from "./support";

/*
 * Issuing vouchers to picked customers. The audience API filters by search, spend and course/diploma
 * enrollment; the page searches a customer, selects them and issues one voucher (then revoked again), and
 * narrows the list by spend and by an enrolled course.
 */

type Customer = { customer_id: string; email: string | null; spend_minor: number; paid_orders: number };
type Audience = { items: Customer[]; total: number };

const audience = async (request: APIRequestContext, body: object, limit = 50) => {
  const response = await request.post("/api/v1/admin/vouchers/audience", { data: body, params: { limit }, headers: fingerprint });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()) as Audience;
};

test("audience API: spend, enrollment and picked filters", async ({ request }) => {
  const everyone = await audience(request, {});
  expect(everyone.total).toBeGreaterThan(0);

  const spenders = await audience(request, { min_spend_minor: 30000 });
  expect(spenders.items.every((c) => c.spend_minor >= 30000)).toBeTruthy();
  expect(spenders.total).toBeLessThan(everyone.total);

  const courses = (await (await request.get("/api/v1/admin/catalog/products", {
    params: { source: "b2c", product_type: "course,diploma,live_diploma", sort: "paid_orders", order: "desc", limit: 5 },
    headers: fingerprint,
  })).json()) as { items: { product_id: string }[] };
  const enrolled = await audience(request, { enrolled_product_ids: courses.items.map((p) => p.product_id) });
  expect(enrolled.total).toBeLessThan(everyone.total);

  const picked = everyone.items.slice(0, 3).map((c) => c.customer_id);
  const only = await audience(request, { customer_ids: picked });
  expect(only.items.map((c) => c.customer_id).sort()).toEqual([...picked].sort());
});

test("pick a customer by email and issue them a voucher", async ({ page, request }) => {
  test.setTimeout(90_000);
  const email = qa().customer;
  await page.goto("/sales/vouchers/new");

  await page.getByLabel(/^(بحث|Search)$/).fill(email);
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toHaveCount(1);
  await row.getByRole("checkbox").check();
  await page.getByRole("button", { name: /المحدّدون \(1\)|Selected \(1\)/ }).click();
  await expect(page.getByText(/1 محدّد|1 selected/)).toBeVisible();

  await page.getByLabel(/قيمة القسيمة|Voucher value/).fill("7");
  await page.getByRole("button", { name: /إصدار للمحدّدين \(1\)|Issue to selected \(1\)/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^(إصدار|Issue)$/ }).click();

  await expect(page).toHaveURL(/\/sales\/vouchers\/[0-9a-f-]{36}$/);
  const voucherId = page.url().split("/").pop()!;
  await expect(page.getByText(email).first()).toBeVisible();

  const revoked = await request.post(`/api/v1/admin/vouchers/${voucherId}/revoke`, { data: { note: "e2e cleanup" }, headers: fingerprint });
  expect(revoked.ok(), await revoked.text()).toBeTruthy();
});

test("narrow the list by spend and by an enrolled course", async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.goto("/sales/vouchers/new");
  const table = page.locator("[aria-busy]");
  const matchCount = page.getByText(/عميل يطابق|customers match/);
  const settled = async () => {
    await expect(table).toHaveAttribute("aria-busy", "false");
    return (await matchCount.textContent())!.replace(/[^\d]/g, "");
  };
  const all = await settled();

  await page.getByLabel(/دفع على الأقل|Paid at least/).fill("300");
  await expect(table).toHaveAttribute("aria-busy", "true");
  const spenders = await settled();
  expect(spenders).toBe(String((await audience(request, { min_spend_minor: 30000 })).total));
  await page.screenshot({ path: "test-results/vouchers-spend.png", fullPage: true });

  await page.getByRole("button", { name: /مسح الفلاتر|Clear filters/ }).click();
  await expect(table).toHaveAttribute("aria-busy", "true");
  expect(await settled()).toBe(all);

  await page.getByRole("button", { name: /مسجّل في دورة أو دبلومة|Enrolled in a course or diploma/ }).click();
  const firstOption = page.locator(".ma-multiselect .ma-check").first();
  await firstOption.click();
  await page.keyboard.press("Escape");
  await expect(table).toHaveAttribute("aria-busy", "true");
  const enrolled = await settled();
  // The first option is the best-selling course or diploma; the API gives its count for comparison.
  const courses = (await (await request.get("/api/v1/admin/catalog/products", {
    params: { source: "b2c", product_type: "course,diploma,live_diploma", sort: "paid_orders", order: "desc", limit: 1 },
    headers: fingerprint,
  })).json()) as { items: { product_id: string }[] };
  expect(enrolled).toBe(String((await audience(request, { enrolled_product_ids: [courses.items[0].product_id] })).total));
  await page.screenshot({ path: "test-results/vouchers-enrolled.png", fullPage: true });
});

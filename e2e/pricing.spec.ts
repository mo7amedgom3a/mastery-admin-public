import { expect, test } from "@playwright/test";

import { fingerprint } from "./support";

/*
 * Bulk pricing, end to end: select one priced product, preview a +10% change rounded to .99, apply it,
 * check the stored price, then revert the batch from the history tab and check the old price is back.
 */

type Price = { amount: string | number; compare_at_amount: string | number | null };

test("bulk price change with preview, apply and revert", async ({ page, request }) => {
  const list = await request.get("/api/v1/admin/catalog/products", {
    params: { source: "b2c", status: "published", product_type: "course", price_min: 1, limit: 1 },
    headers: fingerprint,
  });
  expect(list.ok()).toBeTruthy();
  const [product] = ((await list.json()) as { items: { product_id: string; title: string | null; slug: string }[] }).items;
  test.skip(!product, "no priced published course");
  const priceOf = async () =>
    (await (await request.get(`/api/v1/admin/pricing/products/${product.product_id}`, { headers: fingerprint })).json()) as Price;
  const before = Number((await priceOf()).amount);
  // Same rule as the backend: up to the next price ending in .99.
  const raised = before * 1.1;
  const candidate = Math.ceil(raised) - 0.01;
  const expected = candidate >= raised ? candidate : candidate + 1;

  await page.goto("/sales/pricing");
  await page.getByLabel(/Search title or slug|ابحث بالعنوان أو الرابط/).fill(product.slug);
  const row = page.getByRole("row").filter({ hasText: product.title ?? product.slug });
  await expect(row).toBeVisible();
  await row.getByRole("checkbox").check();

  await page.locator("#bulk-value").fill("10");
  // Operation defaults to percent; pick ".99" rounding.
  await page.getByRole("combobox", { name: /Rounding|التقريب/ }).click();
  await page.getByRole("option", { name: /Ends in \.99|ينتهي بـ \.99/ }).click();
  await page.getByRole("button", { name: /^(Preview|معاينة)$/ }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(expected.toFixed(2));
  await dialog.getByRole("button", { name: /Apply to 1|تطبيق على 1/ }).click();
  await expect(dialog).toBeHidden();
  expect(Number((await priceOf()).amount)).toBeCloseTo(expected, 2);

  await page.getByRole("button", { name: /^(Bulk changes|التعديلات الجماعية)$/ }).click();
  await page.getByRole("row").filter({ hasText: /Applied|مطبّق/ }).first().getByRole("button", { name: /^(Revert|تراجع)$/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^(Revert|تراجع)$/ }).click();
  await expect.poll(async () => Number((await priceOf()).amount)).toBeCloseTo(before, 2);
});

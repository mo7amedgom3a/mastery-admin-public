import { expect, test, type APIRequestContext } from "@playwright/test";

import { fingerprint } from "./support";

/*
 * Availability control in the catalog. A course whose LMS row is inactive, or that has no real price, is
 * flagged "Unavailable" in the list, shows under the Availability filter, and can be unpublished and published
 * again in bulk. Publishing a flagged product warns first. The test creates its own course with a 0 SAR price
 * (the shape of the old import bug) and leaves it unpublished.
 */

type Item = { ref: string; slug: string; status: string; availability_issue?: string | null };
type Page = { items: Item[]; total: number };

const list = async (request: APIRequestContext, params: Record<string, string>) =>
  (await (await request.get("/api/v1/admin/catalog/products", { params, headers: fingerprint })).json()) as Page;

test("flag, filter and bulk unpublish/publish an unavailable course", async ({ page, request }) => {
  test.setTimeout(120_000);
  const stamp = Date.now().toString(36);
  const title = `دورة إتاحة ${stamp}`;
  const categories = (await (await request.get("/api/v1/catalog/categories")).json()) as { category_id: string }[];
  const created = await request.post("/api/v1/admin/catalog/products", {
    data: {
      product_type: "course", title, price: 0, currency_code: "SAR", published: true,
      category_ids: [categories[0].category_id],
    },
    headers: fingerprint,
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { ref, product } = (await created.json()) as { ref: string; product: { slug: string } };

  // The API flags it: a native course has no LMS link (and its only price is a 0 SAR one).
  const flagged = await list(request, { query: stamp, availability: "unavailable" });
  expect(flagged.items.map((item) => item.ref)).toEqual([ref]);
  expect(flagged.items[0].availability_issue).toBeTruthy();
  expect((await list(request, { query: stamp, availability: "available" })).total).toBe(0);

  await page.goto("/learning/courses");
  await page.getByRole("searchbox", { name: /ابحث بالعنوان أو الرابط|Search title or slug/ }).fill(stamp);
  await page.getByRole("combobox", { name: /الإتاحة: الكل|Availability: all/ }).click();
  await page.getByRole("option", { name: /^(غير متاح للبيع|Unavailable)$/ }).click();
  const row = page.getByRole("row").filter({ hasText: stamp });
  await expect(row).toHaveCount(1);
  await expect(row.getByTestId("catalog-unavailable")).toBeVisible();

  // Bulk unpublish the selected row.
  await row.getByTestId("catalog-select").check();
  await expect(page.getByTestId("catalog-bulk-bar")).toBeVisible();
  await page.getByRole("button", { name: /إلغاء نشر المحدد|Unpublish selected/ }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByText(title)).toBeVisible();
  await dialog.getByTestId("catalog-bulk-confirm").click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await list(request, { query: stamp })).items[0]?.status).toBe("unpublished");
  expect((await request.get(`/api/v1/catalog/products/${product.slug}`)).status()).toBe(404);

  // Bulk publish warns that it is unavailable; cancel, then single-row publish asks too, and cancel again.
  await row.getByTestId("catalog-select").check();
  await page.getByRole("button", { name: /^(نشر المحدد|Publish selected)$/ }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/بعضها غير متاح للبيع|Some of these can't really be sold/)).toBeVisible();
  await dialog.getByRole("button", { name: /^(إلغاء|Cancel)$/ }).click();
  await page.getByRole("button", { name: /إلغاء التحديد|Clear/ }).click();
  await row.getByRole("button", { name: /^(نشر|Publish)$/ }).click();
  dialog = page.getByRole("dialog", { name: /نشر منتج غير متاح|Publish an unavailable product/ });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /^(إلغاء|Cancel)$/ }).click();
  expect((await list(request, { query: stamp })).items[0]?.status).toBe("unpublished");
});

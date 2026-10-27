import { expect, test, type APIRequestContext } from "@playwright/test";

import { fingerprint } from "./support";

/*
 * Soft delete and restore of a catalog product, end to end. A published course is created through the API and
 * embedded by the RAG worker; the admin deletes it from its detail page (with a reason), it leaves the default
 * catalog list, the store, search and the vector index, and shows under the "Deleted" filter; restoring it from
 * the list brings all of that back. A curriculum change re-embeds it. The course ends soft-deleted (nothing is
 * hard-deleted). Needs the backend with Temporal and the RAG worker running.
 */

type Detail = {
  ref: string;
  product: { status: string; slug: string; deleted_reason?: string | null };
  b2c: { deleted_by?: string | null; status_before_delete?: string | null } | null;
};
type RagStatus = { state: string; indexed_at: string | null; deleted_reason: string | null };

const api = (request: APIRequestContext) => ({
  detail: async (ref: string) =>
    (await (await request.get(`/api/v1/admin/catalog/products/${encodeURIComponent(ref)}`, { headers: fingerprint })).json()) as Detail,
  rag: async (id: string) =>
    (await (await request.get(`/api/v1/admin/rag/products/${id}`, { headers: fingerprint })).json()) as RagStatus,
  publicStatus: async (slug: string) => (await request.get(`/api/v1/catalog/products/${slug}`)).status(),
  searchHits: async (q: string) =>
    ((await (await request.get("/api/v1/search", { params: { q, search_mode: "lexical", personalize: "false" } })).json()) as {
      total: number;
    }).total,
});

test("delete a course (soft), find it under Deleted, restore it, and keep search + RAG in step", async ({ page, request }) => {
  test.setTimeout(240_000);
  const stamp = Date.now().toString(36);
  const title = `دورة اختبار الحذف المؤقت ${stamp}`;
  const categories = (await (await request.get("/api/v1/catalog/categories")).json()) as { category_id: string }[];
  const created = await request.post("/api/v1/admin/catalog/products", {
    data: { product_type: "course", title, price: 15, currency_code: "USD", published: true, category_ids: [categories[0].category_id] },
    headers: fingerprint,
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { ref, product } = (await created.json()) as Detail;
  const id = ref.replace("b2c:", "");
  const calls = api(request);
  const poll = <T,>(read: () => Promise<T>) => expect.poll(read, { timeout: 90_000, intervals: [1_000, 2_000] });

  await poll(async () => (await calls.rag(id)).state).toBe("indexed");
  expect(await calls.publicStatus(product.slug)).toBe(200);
  await poll(() => calls.searchHits(stamp)).toBe(1);

  // Delete from the detail page, with a reason.
  await page.goto(`/learning/catalog/${encodeURIComponent(ref)}`);
  await page.getByRole("button", { name: /^(حذف|Delete)$/ }).click();
  const dialog = page.getByRole("dialog", { name: /حذف المنتج|Delete this product/ });
  await dialog.getByLabel(/السبب|Reason/).fill("e2e: duplicate");
  await dialog.getByRole("button", { name: /تأكيد الحذف|Confirm delete/ }).click();
  await expect(page.getByText(/هذا المنتج محذوف|This product is deleted/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^(استعادة|Restore)$/ })).toBeVisible();

  const deleted = await calls.detail(ref);
  expect(deleted.product.status).toBe("deleted");
  expect(deleted.product.deleted_reason).toBe("e2e: duplicate");
  expect(deleted.b2c?.status_before_delete).toBe("published");
  expect(deleted.b2c?.deleted_by).toBeTruthy();
  expect(await calls.publicStatus(product.slug)).toBe(404);
  await poll(() => calls.searchHits(stamp)).toBe(0);
  await poll(async () => (await calls.rag(id)).state).toBe("deleted");

  // Hidden from the default catalog list; listed (and restorable) under the Deleted filter.
  await page.goto("/learning/catalog");
  // The catalog list's own search (the sidebar has a page search too); wait for its request, then expect no row.
  const listed = page.waitForResponse((r) => r.url().includes("/admin/catalog/products?") && r.url().includes(stamp));
  const listSearch = page.getByRole("searchbox", { name: /ابحث بالعنوان أو الرابط|Search title or slug/ });
  await listSearch.fill(stamp);
  await listSearch.press("Enter");
  expect(((await (await listed).json()) as { total: number }).total).toBe(0);
  await expect(page.getByRole("row").filter({ hasText: stamp })).toHaveCount(0);
  await page.getByRole("combobox", { name: /كل الحالات|All states/ }).click();
  await page.getByRole("option", { name: /^(محذوف|Deleted)$/ }).click();
  const row = page.getByRole("row").filter({ hasText: stamp });
  await expect(row).toBeVisible();
  await expect(row.getByText(/^(محذوف|Deleted)$/)).toBeVisible();
  await row.getByRole("button", { name: /^(استعادة|Restore)$/ }).click();
  await expect(page.getByText(/تمت استعادة المنتج|Product restored/)).toBeVisible();

  await poll(async () => (await calls.detail(ref)).product.status).toBe("published");
  expect(await calls.publicStatus(product.slug)).toBe(200);
  await poll(() => calls.searchHits(stamp)).toBe(1);
  await poll(async () => (await calls.rag(id)).state).toBe("indexed");

  // Publishing content changes re-embeds the course: a new curriculum unit.
  const before = (await calls.rag(id)).indexed_at;
  const unit = await request.post(`/api/v1/admin/catalog/products/${encodeURIComponent(ref)}/units`, {
    data: { name: `وحدة تقسيم الطوائف ${stamp}`, description: "تقسيم خلايا النحل وتربية ملكات جديدة في الربيع" },
    headers: fingerprint,
  });
  expect(unit.ok(), await unit.text()).toBeTruthy();
  await poll(async () => (await calls.rag(id)).indexed_at).not.toBe(before);

  // Clean up the way an admin would: soft delete (rows stay, nothing is erased).
  const cleanup = await request.delete(`/api/v1/admin/catalog/products/${encodeURIComponent(ref)}`, {
    params: { reason: "e2e cleanup" },
    headers: fingerprint,
  });
  expect(cleanup.ok()).toBeTruthy();
});

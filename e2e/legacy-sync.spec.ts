import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { fingerprint } from "./support";

/*
 * Two-way catalog sync on the local `legacy` mirror, against the live API and legacy sync worker.
 * B2C → LMS: a course created in the admin reaches MAS_DEF_Course; edit, delete and restore follow.
 * LMS → B2C: a row inserted in the LMS tables becomes an admin draft, B2C keeps its content when the LMS edits it, a
 * price edit is only logged, publishing keeps the LMS course active, and removing the row soft-deletes the product.
 * Writes real dev data. Needs LEGACY_SYNC_* on and SA_PASSWORD (docs/db_access.txt). Never run against production.
 */

const shots = process.env.E2E_SHOTS_DIR ?? "test-results/legacy-sync";
const LMS_ID = 900_500_000 + Math.floor(Date.now() / 1000) % 400_000;

function sql(statement: string): string {
  return execFileSync("docker", [
    "exec", "mssql_db", "/opt/mssql-tools18/bin/sqlcmd", "-C", "-I", "-b", "-h", "-1", "-W", "-S", "localhost",
    "-U", "sa", "-P", process.env.SA_PASSWORD ?? "", "-d", "mastery_b2c_dev", "-Q", `SET NOCOUNT ON; ${statement}`,
  ], { encoding: "utf-8" }).trim();
}

type Detail = { ref: string; product: { status: string; slug: string; title: string; price?: number | null } };
type Listing = { items: { ref: string; title: string | null; status: string }[] };

const headers = fingerprint;
const detail = async (request: APIRequestContext, ref: string) =>
  (await (await request.get(`/api/v1/admin/catalog/products/${encodeURIComponent(ref)}`, { headers })).json()) as Detail;
const productPage = (ref: string) => `/learning/catalog/${encodeURIComponent(ref)}`;
const shot = (page: Page, name: string) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
const slow = <T,>(read: () => Promise<T>) => expect.poll(read, { timeout: 150_000, intervals: [2_000, 3_000] });

async function sweepFromAdmin(page: Page): Promise<void> {
  await page.goto("/learning/catalog");
  const started = page.waitForResponse((response) => response.url().includes("/legacy-sync/sweep"));
  await page.getByTestId("legacy-sweep").click();
  expect((await started).status()).toBe(202);
}

test.beforeAll(() => mkdirSync(shots, { recursive: true }));

test("a course created in the admin is reflected in the legacy tables", async ({ page, request }) => {
  test.setTimeout(420_000);
  const stamp = Date.now().toString(36);
  const title = `دورة مزامنة B2C ${stamp}`;

  // First sweep baselines every migrated product, so nothing existing is overwritten.
  await sweepFromAdmin(page);
  await slow(() => sql(`SELECT COUNT(*) FROM b2c.products p WHERE p.product_type IN (N'course', N'diploma')
                        AND p.status NOT IN (N'archived', N'deleted')
                        AND NOT EXISTS (SELECT 1 FROM b2c.legacy_sync_state s WHERE s.product_id = p.product_id)`)).toBe("0");

  await page.goto("/learning/courses/new");
  await page.getByRole("textbox", { name: /^(الاسم|Name)$/ }).fill(title);
  await page.getByRole("spinbutton", { name: /السعر \(USD\)|Price \(USD\)/ }).fill("15");
  await page.getByRole("checkbox", { name: /^(التسويق المتكامل|Integrated marketing)/ }).check({ force: true });
  await page.getByRole("group", { name: /اختر المدربين|Pick instructors/ }).getByRole("checkbox").first().check({ force: true });
  await page.getByRole("checkbox", { name: /نشر الآن|Publish now/ }).check({ force: true });
  await shot(page, "01-admin-new-course");
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/learning\/catalog\/b2c.*\/studio/, { timeout: 30_000 });
  const ref = decodeURIComponent(new URL(page.url()).pathname.split("/").at(-2) ?? "");
  const productId = ref.replace("b2c:", "");

  const legacyId = () => sql(`SELECT legacy_id FROM b2c_sync.product_keys WHERE product_id = '${productId}'`);
  await slow(legacyId).toMatch(/^9\d{8}$/);
  const id = legacyId();
  expect(sql(`SELECT CONCAT(name, '|', CAST(active AS INT), '|', CAST(type AS INT)) FROM legacy.MAS_DEF_Course WHERE Id = ${id}`))
    .toBe(`${title}|1|1`);
  expect(sql(`SELECT CAST(price AS INT) FROM legacy.MAS_COU_Price_List WHERE courseId = ${id} AND isMainPrice = 1`)).toBe("15");
  expect(sql(`SELECT COUNT(*) FROM legacy.MAS_COU_Trainers WHERE courseId = ${id}`)).toBe("1");
  expect(sql(`SELECT COUNT(*) FROM legacy.MAS_COU_IN_Categories WHERE courseId = ${id}`)).toBe("1");
  expect(sql(`SELECT lms_reference_id FROM b2c.resources r JOIN b2c.product_resources pr ON pr.resource_id = r.resource_id
              WHERE pr.product_id = '${productId}'`)).toBe(id);

  await page.goto(productPage(ref));
  const card = page.getByTestId("legacy-sync-card");
  await expect(page.getByTestId("legacy-sync-id")).toContainText(id);
  await expect(page.getByTestId("legacy-sync-status")).toHaveText(/متزامن|Synced/);
  await expect(page.getByTestId("legacy-sync-empty")).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await shot(page, "02-admin-course-synced-to-lms");

  // An edit follows, without touching anything else.
  const renamed = `${title} معدل`;
  const updated = await request.patch(`/api/v1/admin/catalog/products/${encodeURIComponent(ref)}`, { data: { title: renamed }, headers });
  expect(updated.ok(), await updated.text()).toBeTruthy();
  await slow(() => sql(`SELECT name FROM legacy.MAS_DEF_Course WHERE Id = ${id}`)).toBe(renamed);

  // A price change follows too.
  const priced = await request.put(`/api/v1/admin/pricing/products/${productId}`, { data: { amount: 25, currency_code: "USD" }, headers });
  expect(priced.ok(), await priced.text()).toBeTruthy();
  await slow(() => sql(`SELECT CAST(price AS INT) FROM legacy.MAS_COU_Price_List WHERE courseId = ${id} AND isMainPrice = 1`)).toBe("25");
  expect(sql(`SELECT COUNT(*) FROM legacy.MAS_COU_Price_List WHERE courseId = ${id}`)).toBe("1");

  // Delete deactivates the LMS course; the row stays. Restore brings it back.
  await page.goto(productPage(ref));
  await page.getByRole("button", { name: /^(حذف|Delete)$/ }).click();
  const dialog = page.getByRole("dialog", { name: /حذف المنتج|Delete this product/ });
  await dialog.getByRole("button", { name: /تأكيد الحذف|Confirm delete/ }).click();
  await expect(page.getByText(/هذا المنتج محذوف|This product is deleted/)).toBeVisible();
  const active = () => sql(`SELECT CAST(active AS INT) FROM legacy.MAS_DEF_Course WHERE Id = ${id}`);
  await slow(active).toBe("0");
  await page.getByRole("button", { name: /^(استعادة|Restore)$/ }).click();
  await slow(active).toBe("1");
  expect(sql(`SELECT COUNT(*) FROM legacy.MAS_DEF_Course WHERE name = N'${renamed}'`)).toBe("1");
});

test("a course added in the LMS shows in the admin as a draft and stays in sync", async ({ page, request }) => {
  test.setTimeout(420_000);
  const name = `دورة LMS جديدة ${LMS_ID}`;
  const category = sql("SELECT TOP 1 legacy_category_id FROM b2c.categories WHERE legacy_category_id IS NOT NULL ORDER BY sort_order");
  sql(`INSERT INTO legacy.MAS_DEF_Course (Id, name, description, intro, discussed, active, addedBy, addedDate, isDiploma, linkName, type, showInListing)
       VALUES (${LMS_ID}, N'${name}', N'وصف من LMS', N'مقدمة من LMS', 0, 1, 42, SYSUTCDATETIME(), 0, N'lms-${LMS_ID}', 1, 1);
       INSERT INTO legacy.MAS_COU_Price_List (Id, name, courseId, price, active, isMainPrice) VALUES (${LMS_ID}, N'السعر الرئيسي', ${LMS_ID}, 77, 1, 1);
       INSERT INTO legacy.MAS_COU_IN_Categories (Id, courseId, categoryId) VALUES (${LMS_ID}, ${LMS_ID}, ${category});`);

  try {
    await sweepFromAdmin(page);
    const listed = async () => {
      const response = await request.get("/api/v1/admin/catalog/products", { params: { query: String(LMS_ID), status: "draft", limit: 5 }, headers });
      return ((await response.json()) as Listing).items.filter((item) => item.title === name);
    };
    await slow(async () => (await listed()).length).toBe(1);
    const ref = (await listed())[0].ref;

    // Visible in the admin catalog as a draft.
    await page.goto("/learning/catalog");
    const search = page.getByRole("searchbox", { name: /ابحث بالعنوان أو الرابط|Search title or slug/ });
    await search.fill(String(LMS_ID));
    await search.press("Enter");
    await expect(page.getByRole("link", { name: new RegExp(name) }).first()).toBeVisible({ timeout: 20_000 });
    await shot(page, "03-admin-lms-course-as-draft");

    const created = await detail(request, ref);
    expect(created.product.status).toBe("draft");
    expect(created.product.slug).toBe(`course-${LMS_ID}`);
    expect((await request.get(`/api/v1/catalog/products/${created.product.slug}`)).status()).toBe(404);

    await page.goto(productPage(ref));
    await expect(page.getByTestId("legacy-sync-id")).toContainText(String(LMS_ID));
    await shot(page, "04-admin-draft-linked-to-lms");

    // B2C controls content: an LMS edit is logged and not applied.
    const edited = `${name} معدلة`;
    sql(`UPDATE legacy.MAS_DEF_Course SET name = N'${edited}' WHERE Id = ${LMS_ID}`);
    await sweepFromAdmin(page);
    await slow(() => sql(`SELECT COUNT(*) FROM b2c.legacy_sync_events WHERE legacy_id = ${LMS_ID} AND action = N'content_drift' AND outcome = N'b2c_wins'`)).toBe("1");
    expect((await detail(request, ref)).product.title).toBe(name);

    // An LMS price edit is logged, never applied.
    const price = sql(`SELECT CAST(amount AS INT) FROM b2c.prices p JOIN b2c.products x ON x.product_id = p.product_id
                       WHERE x.slug = N'course-${LMS_ID}' AND p.valid_to IS NULL`);
    expect(price).toBe("77");
    sql(`UPDATE legacy.MAS_COU_Price_List SET price = 99 WHERE Id = ${LMS_ID}`);
    await sweepFromAdmin(page);
    await slow(() => sql(`SELECT COUNT(*) FROM b2c.legacy_sync_events WHERE legacy_id = ${LMS_ID} AND action = N'price_drift'`)).toBe("1");
    expect(sql(`SELECT CAST(amount AS INT) FROM b2c.prices p JOIN b2c.products x ON x.product_id = p.product_id
                WHERE x.slug = N'course-${LMS_ID}' AND p.valid_to IS NULL`)).toBe("77");

    // The same field edited on both sides keeps B2C, and B2C goes back to the LMS.
    const conflictId = ref.replace("b2c:", "");
    sql(`UPDATE legacy.MAS_DEF_Course SET intro = N'مقدمة LMS متعارضة' WHERE Id = ${LMS_ID};
         UPDATE b2c.product_translations SET short_description = N'مقدمة B2C' WHERE product_id = '${conflictId}';`);
    await sweepFromAdmin(page);
    await slow(() => sql(`SELECT COUNT(*) FROM b2c.legacy_sync_events WHERE legacy_id = ${LMS_ID} AND action = N'content_drift'`)).toBe("2");
    await slow(() => sql(`SELECT intro FROM legacy.MAS_DEF_Course WHERE Id = ${LMS_ID}`)).toBe("مقدمة B2C");

    // A B2C edit while still a draft leaves the live LMS course active.
    const draftEdit = await request.patch(`/api/v1/admin/catalog/products/${encodeURIComponent(ref)}`, { data: { description: "وصف من الإدارة" }, headers });
    expect(draftEdit.ok(), await draftEdit.text()).toBeTruthy();
    await slow(() => sql(`SELECT description FROM legacy.MAS_DEF_Course WHERE Id = ${LMS_ID}`)).toBe("وصف من الإدارة");
    expect(sql(`SELECT CAST(active AS INT) FROM legacy.MAS_DEF_Course WHERE Id = ${LMS_ID}`)).toBe("1");

    // Publishing from the admin puts it on the storefront.
    const published = await request.post(`/api/v1/admin/catalog/products/${encodeURIComponent(ref)}/status`, { data: { status: "published" }, headers });
    expect(published.ok(), await published.text()).toBeTruthy();
    await slow(async () => (await request.get(`/api/v1/catalog/products/course-${LMS_ID}`)).status()).toBe(200);
    await page.goto(productPage(ref));
    await shot(page, "05-admin-lms-course-published");

    // Deactivating in the LMS unpublishes; removing the row soft-deletes. Publishing pushes active = 1 in the
    // background, so wait for that push or it would overwrite the LMS change below.
    await slow(() => sql(`SELECT COUNT(*) FROM b2c.legacy_sync_events WHERE legacy_id = ${LMS_ID} AND direction = N'outbound' AND details_json LIKE N'%"status": "published"%'`)).toBe("1");
    sql(`UPDATE legacy.MAS_DEF_Course SET active = 0 WHERE Id = ${LMS_ID}`);
    await sweepFromAdmin(page);
    await slow(async () => (await detail(request, ref)).product.status).toBe("draft");

    sql(`DELETE FROM legacy.MAS_COU_IN_Categories WHERE courseId = ${LMS_ID};
         DELETE FROM legacy.MAS_COU_Price_List WHERE courseId = ${LMS_ID};
         DELETE FROM legacy.MAS_DEF_Course WHERE Id = ${LMS_ID};`);
    await sweepFromAdmin(page);
    await slow(async () => (await detail(request, ref)).product.status).toBe("deleted");
    await slow(() => sql(`SELECT COUNT(*) FROM b2c.audit_logs WHERE action = N'catalog.legacy_sync_deleted'
                          AND entity_id = '${ref.replace("b2c:", "")}'`)).toBe("1");
    await page.goto(productPage(ref));
    await shot(page, "06-admin-removed-from-lms");
  } finally {
    sql(`DELETE FROM legacy.MAS_COU_IN_Categories WHERE courseId = ${LMS_ID};
         DELETE FROM legacy.MAS_COU_Price_List WHERE courseId = ${LMS_ID};
         DELETE FROM legacy.MAS_DEF_Course WHERE Id = ${LMS_ID};`);
  }
});

test("a sweep with nothing to do changes nothing", async ({ page }) => {
  test.setTimeout(180_000);
  await page.waitForTimeout(30_000); // The burst above can exhaust the shared local rate limit.
  const count = () => sql("SELECT COUNT(*) FROM b2c.legacy_sync_events");
  await sweepFromAdmin(page);
  await page.waitForTimeout(15_000); // Lets the sweep above and any earlier one finish.
  const before = count();
  await sweepFromAdmin(page);
  await page.waitForTimeout(15_000);
  expect(count()).toBe(before);
});

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";

import { expect, test, type APIRequestContext } from "@playwright/test";

import { fingerprint } from "./support";

/*
 * Legacy sync phase 3 on the local `legacy` mirror, against the live API and legacy sync worker: the content of a
 * B2C-made course, packages and consultations, both ways. Local database only. Needs LEGACY_SYNC_* on and SA_PASSWORD.
 */

const shots = process.env.E2E_SHOTS_DIR ?? "test-results/legacy-sync";
const headers = fingerprint;
const BASE = 900_100_000 + Math.floor(Date.now() / 1000) % 300_000;

function sql(statement: string): string {
  return execFileSync("docker", [
    "exec", "mssql_db", "/opt/mssql-tools18/bin/sqlcmd", "-C", "-I", "-b", "-h", "-1", "-W", "-S", "localhost",
    "-U", "sa", "-P", process.env.SA_PASSWORD ?? "", "-d", "mastery_b2c_dev", "-Q", `SET NOCOUNT ON; ${statement}`,
  ], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

const slow = <T,>(read: () => Promise<T> | T) => expect.poll(async () => read(), { timeout: 120_000, intervals: [2_000, 3_000] });
const keyOf = (productId: string) => sql(`SELECT legacy_id FROM b2c_sync.product_keys WHERE product_id = '${productId}'`);
const category = () => sql("SELECT TOP 1 LOWER(CONVERT(NVARCHAR(36), category_id)) FROM b2c.categories WHERE legacy_category_id IS NOT NULL ORDER BY sort_order");

async function create(request: APIRequestContext, data: Record<string, unknown>): Promise<{ ref: string; id: string }> {
  const response = await request.post("/api/v1/admin/catalog/products", { data, headers });
  expect(response.ok(), await response.text()).toBeTruthy();
  const { ref } = (await response.json()) as { ref: string };
  return { ref, id: ref.replace("b2c:", "") };
}

async function sweep(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/v1/admin/catalog/legacy-sync/sweep", { headers });
  expect(response.status(), await response.text()).toBe(202);
}

const productBySlug = (slug: string) =>
  sql(`SELECT CONCAT(LOWER(CONVERT(NVARCHAR(36), product_id)), '|', status) FROM b2c.products WHERE slug = N'${slug}'`);

test.beforeAll(() => mkdirSync(shots, { recursive: true }));

test("units and lessons of a B2C course reach the LMS tables, and an LMS-owned course is refused", async ({ page, request }) => {
  test.setTimeout(300_000);
  const stamp = Date.now().toString(36);
  const course = await create(request, { product_type: "course", title: `دورة محتوى ${stamp}`, price: 20, currency_code: "USD", published: false, category_ids: [category()] });
  await slow(() => keyOf(course.id)).toMatch(/^9\d{8}$/);
  const legacyId = keyOf(course.id);
  const ref = encodeURIComponent(course.ref);
  const fileId = sql("SELECT TOP 1 Id FROM legacy.MAS_FIL_Bank WHERE type = 1 ORDER BY Id DESC");

  const unit = await request.post(`/api/v1/admin/catalog/products/${ref}/units`, { data: { name: "الوحدة الأولى" }, headers });
  expect(unit.ok(), await unit.text()).toBeTruthy();
  const unitId = ((await unit.json()) as { id: number }).id;
  const lessons = `/api/v1/admin/catalog/products/${ref}/units/${unitId}/lessons`;
  const video = await request.post(lessons, { data: { name: "درس فيديو", duration: 120, file_id: Number(fileId), is_free: true }, headers });
  expect(video.ok(), await video.text()).toBeTruthy();
  const reading = await request.post(lessons, { data: { name: "درس مقروء", body: "<p>نص</p>" }, headers });
  expect(reading.ok(), await reading.text()).toBeTruthy();
  const videoId = ((await video.json()) as { id: number }).id;
  const readingId = ((await reading.json()) as { id: number }).id;

  const materials = (where = "1 = 1") => sql(`SELECT COUNT(*) FROM legacy.MAS_UNI_Materials m JOIN legacy.MAS_COU_Units u ON u.Id = m.unitId WHERE u.courseId = ${legacyId} AND ${where}`);
  await slow(() => materials()).toBe("2");
  expect(sql(`SELECT COUNT(*) FROM legacy.MAS_COU_Units WHERE courseId = ${legacyId}`)).toBe("1");
  expect(sql(`SELECT CONCAT(type, '|', fileId, '|', CAST(isFree AS INT)) FROM legacy.MAS_MAT_Contents WHERE courseId = ${legacyId}`)).toBe(`1|${fileId}|1`);

  const status = (await (await request.get(`/api/v1/admin/catalog/products/${ref}/legacy-sync`, { headers })).json()) as { lms_units: number; lms_videos: number };
  expect([status.lms_units, status.lms_videos]).toEqual([1, 1]);
  await page.goto(`/learning/catalog/${ref}`);
  await expect(page.getByTestId("legacy-sync-id")).toContainText(legacyId);
  await expect(page.getByTestId("legacy-sync-empty")).toHaveCount(0);
  await page.screenshot({ path: `${shots}/07-admin-course-content-in-lms.png`, fullPage: true });

  // Edit and delete follow, without a duplicate video row.
  const renamed = await request.put(`${lessons}/${videoId}`, { data: { name: "درس فيديو معدل" }, headers });
  expect(renamed.ok(), await renamed.text()).toBeTruthy();
  await slow(() => materials("m.name = N'درس فيديو معدل'")).toBe("1");
  expect(sql(`SELECT COUNT(*) FROM legacy.MAS_MAT_Contents WHERE courseId = ${legacyId}`)).toBe("1");
  const removed = await request.delete(`${lessons}/${readingId}`, { headers });
  expect(removed.ok(), await removed.text()).toBeTruthy();
  await slow(() => materials()).toBe("1");

  // The procedure itself refuses a course B2C did not create.
  const owned = sql("SELECT TOP 1 c.Id FROM legacy.MAS_DEF_Course c WHERE c.Id < 900000000 AND EXISTS (SELECT 1 FROM legacy.MAS_COU_Units u WHERE u.courseId = c.Id) ORDER BY c.Id DESC");
  const before = sql(`SELECT COUNT(*) FROM legacy.MAS_COU_Units WHERE courseId = ${owned}`);
  expect(() => sql(`EXEC legacy.usp_b2c_catalog_sync_course_content @request_id = N'r', @idempotency_key = N'k',
    @product_id = '${course.id}', @legacy_id = ${owned}, @content = N'[]', @added_by = 42, @local_id_floor = 900000000`)).toThrow();
  expect(sql(`SELECT COUNT(*) FROM legacy.MAS_COU_Units WHERE courseId = ${owned}`)).toBe(before);
});

test("a B2C package reaches the LMS with its courses, and LMS edits come back", async ({ page, request }) => {
  test.setTimeout(300_000);
  const stamp = Date.now().toString(36);
  const member = await create(request, { product_type: "course", title: `عضو باقة ${stamp}`, price: 10, currency_code: "USD", published: true, category_ids: [category()] });
  await slow(() => keyOf(member.id)).toMatch(/^9\d{8}$/);
  const pkg = await create(request, { product_type: "package", title: `باقة B2C ${stamp}`, price: 50, currency_code: "USD", published: true, category_ids: [category()], course_refs: [member.ref] });
  await slow(() => keyOf(pkg.id)).toMatch(/^9\d{8}$/);
  const legacyId = keyOf(pkg.id);

  expect(sql(`SELECT CONCAT(name, '|', CAST(active AS INT)) FROM legacy.MAS_COU_Curriculum WHERE Id = ${legacyId}`)).toBe(`باقة B2C ${stamp}|1`);
  expect(sql(`SELECT courseId FROM legacy.MAS_CUR_Courses WHERE curriculaId = ${legacyId}`)).toBe(keyOf(member.id));
  expect(sql(`SELECT CAST(price AS INT) FROM legacy.MAS_CUR_Price_List WHERE curriculaId = ${legacyId} AND isMainPrice = 1`)).toBe("50");
  expect(sql(`SELECT r.lms_reference_id FROM b2c.resources r JOIN b2c.product_resources pr ON pr.resource_id = r.resource_id
              WHERE pr.product_id = '${pkg.id}' AND r.resource_type = N'curriculum'`)).toBe(legacyId);

  await page.goto(`/learning/catalog/${encodeURIComponent(pkg.ref)}`);
  await expect(page.getByTestId("legacy-sync-id")).toContainText(legacyId);
  await page.screenshot({ path: `${shots}/08-admin-package-in-lms.png`, fullPage: true });

  const edited = `باقة معدلة في LMS ${stamp}`;
  sql(`UPDATE legacy.MAS_COU_Curriculum SET name = N'${edited}' WHERE Id = ${legacyId}`);
  await sweep(request);
  await slow(() => sql(`SELECT title FROM b2c.product_translations WHERE product_id = '${pkg.id}' AND locale_code LIKE 'ar%'`)).toBe(edited);
});

test("a B2C consultation reaches the LMS with its expert and price", async ({ request }) => {
  test.setTimeout(240_000);
  const stamp = Date.now().toString(36);
  const expert = sql("SELECT TOP 1 c.legacy_consultant_id FROM b2c.consultants c JOIN legacy.MAS_DEF_Consultants l ON l.Id = c.legacy_consultant_id ORDER BY c.legacy_consultant_id DESC");
  const item = await create(request, { product_type: "consultation", title: `استشارة B2C ${stamp}`, price: 129, currency_code: "USD", published: true, category_ids: [category()], expert_ids: [Number(expert)], duration_minutes: 45 });
  await slow(() => keyOf(item.id)).toMatch(/^9\d{8}$/);
  const legacyId = keyOf(item.id);
  expect(sql(`SELECT CONCAT(consultantId, '|', CAST([time] AS INT), '|', CAST(price AS INT), '|', CAST(active AS INT)) FROM legacy.MAS_DEF_Consultancy WHERE Id = ${legacyId}`))
    .toBe(`${expert}|45|129|1`);

  const priced = await request.put(`/api/v1/admin/pricing/products/${item.id}`, { data: { amount: 150, currency_code: "USD" }, headers });
  expect(priced.ok(), await priced.text()).toBeTruthy();
  await slow(() => sql(`SELECT CAST(price AS INT) FROM legacy.MAS_DEF_Consultancy WHERE Id = ${legacyId}`)).toBe("150");
});

test("a package and a consultation added in the LMS become B2C drafts", async ({ page, request }) => {
  test.setTimeout(300_000);
  const packageId = BASE;
  const consultationId = BASE + 1;
  const memberCourse = sql("SELECT TOP 1 c.Id FROM legacy.MAS_DEF_Course c WHERE c.Id < 900000000 AND c.active = 1 ORDER BY c.Id DESC");
  const expert = sql("SELECT TOP 1 c.legacy_consultant_id FROM b2c.consultants c JOIN legacy.MAS_DEF_Consultants l ON l.Id = c.legacy_consultant_id ORDER BY c.legacy_consultant_id DESC");
  const cleanup = `DELETE FROM legacy.MAS_CUR_Courses WHERE curriculaId = ${packageId};
                   DELETE FROM legacy.MAS_CUR_Price_List WHERE curriculaId = ${packageId};
                   DELETE FROM legacy.MAS_COU_Curriculum WHERE Id = ${packageId};
                   DELETE FROM legacy.MAS_DEF_Consultancy WHERE Id = ${consultationId};`;
  sql(`INSERT INTO legacy.MAS_COU_Curriculum (Id, name, description, price, addedBy, active, linkName, showInListing)
       VALUES (${packageId}, N'باقة LMS ${packageId}', N'وصف', 0, 42, 1, N'lms-pkg-${packageId}', 1);
       INSERT INTO legacy.MAS_CUR_Price_List (Id, name, curriculaId, price, active, isMainPrice) VALUES (${packageId}, N'السعر الرئيسي', ${packageId}, 300, 1, 1);
       INSERT INTO legacy.MAS_CUR_Courses (Id, curriculaId, courseId, required) VALUES (${packageId}, ${packageId}, ${memberCourse}, 1);
       INSERT INTO legacy.MAS_DEF_Consultancy (Id, consultantId, active, name, body, [time], price, numberOfSessions)
       VALUES (${consultationId}, ${expert}, 1, N'استشارة LMS ${consultationId}', N'وصف', 30, 99, 1);`);
  try {
    await sweep(request);
    await slow(() => productBySlug(`package-${packageId}`)).toMatch(/\|draft$/);
    await slow(() => productBySlug(`consultation-${consultationId}`)).toMatch(/\|draft$/);
    const pkg = productBySlug(`package-${packageId}`).split("|")[0];
    const consultation = productBySlug(`consultation-${consultationId}`).split("|")[0];

    expect(sql(`SELECT COUNT(*) FROM b2c.package_items WHERE package_product_id = '${pkg}'`)).toBe("1");
    expect(sql(`SELECT CAST(amount AS INT) FROM b2c.prices WHERE product_id = '${pkg}' AND valid_to IS NULL`)).toBe("300");
    expect(sql(`SELECT duration_minutes FROM b2c.consultation_services WHERE product_id = '${consultation}'`)).toBe("30");
    expect(sql(`SELECT CAST(active AS INT) FROM legacy.MAS_COU_Curriculum WHERE Id = ${packageId}`)).toBe("1");

    await page.goto(`/learning/catalog/${encodeURIComponent(`b2c:${pkg}`)}`);
    await expect(page.getByTestId("legacy-sync-id")).toContainText(String(packageId));
    await page.screenshot({ path: `${shots}/09-admin-lms-package-as-draft.png`, fullPage: true });

    sql(cleanup);
    await sweep(request);
    await slow(() => productBySlug(`package-${packageId}`)).toMatch(/\|deleted$/);
    await slow(() => productBySlug(`consultation-${consultationId}`)).toMatch(/\|deleted$/);
  } finally {
    sql(cleanup);
  }
});

test("a sweep after all of that changes nothing and nothing failed", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.waitForTimeout(20_000);
  await sweep(request);
  await page.waitForTimeout(20_000);
  const before = sql("SELECT COUNT(*) FROM b2c.legacy_sync_events");
  await sweep(request);
  await page.waitForTimeout(20_000);
  expect(sql("SELECT COUNT(*) FROM b2c.legacy_sync_events")).toBe(before);
  expect(sql("SELECT COUNT(*) FROM b2c.legacy_sync_state WHERE sync_status = N'failed'")).toBe("0");
});

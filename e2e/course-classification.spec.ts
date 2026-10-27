import { expect, test } from "@playwright/test";

import { fingerprint } from "./support";

/*
 * Course classification, end to end: create a draft course, then on its catalog detail page attach a field
 * and one of its sub-categories, create a new skill from the skill search, add an ASCII and an Arabic tag,
 * save, check the stored classification through the API, and publish from the header. The course is archived
 * afterwards. The storefront side (search filters) is `mastery-front/e2e/search-classification.spec.ts`.
 */

type Category = { category_id: string; slug: string; name: string | null; parent_id: string | null };
type Detail = {
  ref: string;
  product: { status: string; slug: string };
  b2c: { category_ids: string[]; field_ids: string[]; skills: { slug: string; name: string }[]; admin_tags: string[] } | null;
};

test("attach field, category, a new skill and new tags to a course, then publish", async ({ page, request }) => {
  test.setTimeout(120_000);
  const categories = (await (await request.get("/api/v1/catalog/categories", { headers: fingerprint })).json()) as Category[];
  const field = categories.find((item) => !item.parent_id && categories.some((child) => child.parent_id === item.category_id));
  test.skip(!field, "no field (top-level category) with sub-categories in this database");
  const sub = categories.find((item) => item.parent_id === field!.category_id)!;

  const stamp = Date.now().toString(36);
  const title = `E2E تصنيف ${stamp}`;
  const skillName = `E2E Skill ${stamp}`;
  const asciiTag = `e2e-tag-${stamp}`;
  const arabicTag = `وسم تجربة ${stamp}`;

  const created = await request.post("/api/v1/admin/catalog/products", {
    data: { product_type: "course", title, price: 10, currency_code: "USD", published: false, category_ids: [field!.category_id] },
    headers: fingerprint,
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const { ref } = (await created.json()) as Detail;
  const detail = async () =>
    (await (await request.get(`/api/v1/admin/catalog/products/${encodeURIComponent(ref)}`, { headers: fingerprint })).json()) as Detail;

  try {
    await page.goto(`/learning/catalog/${encodeURIComponent(ref)}`);
    const card = page.locator("form").filter({ has: page.getByRole("button", { name: /Save classification|حفظ التصنيف/ }) });
    await expect(card).toBeVisible();

    // The field the course was created with is shown as picked; add one of its sub-categories.
    await expect(card.getByRole("group", { name: /^(Fields|المجالات)$/ }).getByLabel(field!.name ?? field!.slug)).toBeChecked();
    const subGroup = card.getByRole("group", { name: /^(Categories|التصنيفات)$/ });
    const subSearch = card.locator("#classification-categories");
    if (await subSearch.isVisible()) await subSearch.fill(sub.name ?? sub.slug);
    await subGroup.getByLabel(sub.name ?? sub.slug).check();

    // A skill that doesn't exist yet: search, create, and it is selected.
    await card.locator("#classification-skills").fill(skillName);
    await card.getByRole("button", { name: new RegExp(`(Create skill|إنشاء مهارة).*${skillName}`) }).click();
    await card.getByRole("button", { name: /^(Create skill|إنشاء المهارة)$/ }).click();
    await expect(card.getByRole("group", { name: /^(Skills|المهارات)$/ }).getByLabel(new RegExp(skillName))).toBeChecked();

    // Tags are free text: new ones are typed in.
    const tagInput = card.locator("#classification-tags-input");
    await tagInput.fill(asciiTag);
    await tagInput.press("Enter");
    await tagInput.fill(arabicTag);
    await tagInput.press("Enter");

    await card.getByRole("button", { name: /Save classification|حفظ التصنيف/ }).click();
    await expect(page.getByText(/Classification saved|تم حفظ التصنيف/)).toBeVisible();

    const saved = (await detail()).b2c!;
    expect(saved.category_ids.toSorted()).toEqual([field!.category_id, sub.category_id].toSorted());
    expect(saved.field_ids).toEqual([field!.category_id]);
    expect(saved.skills.map((skill) => skill.name)).toContain(skillName);
    expect(saved.skills.find((skill) => skill.name === skillName)?.slug).toBe(`e2e-skill-${stamp}`);
    expect(saved.admin_tags.toSorted()).toEqual([asciiTag, arabicTag].toSorted());

    // Publish from the header.
    await page.getByRole("button", { name: /^(Publish|نشر)$/ }).first().click();
    await page.getByRole("button", { name: /Confirm publish|تأكيد النشر/ }).click();
    await expect.poll(async () => (await detail()).product.status).toBe("published");
  } finally {
    await request.post(`/api/v1/admin/catalog/products/${encodeURIComponent(ref)}/status`, {
      data: { status: "archived" },
      headers: fingerprint,
    });
  }
});

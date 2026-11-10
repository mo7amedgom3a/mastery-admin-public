import { expect, test } from "@playwright/test";

import { fingerprint } from "./support";

/*
 * Announcement bar, end to end: create a bar from the list, give it a gradient preset and a coupon item
 * (copy-coupon action), save, publish, check the public API serves it with the coupon, check the live
 * storefront preview renders the item, then archive the bar and the test coupon.
 */

type PublicBars = { bars: { id: string; style: { bg: { colors: string[] } }; items: { text: string; coupon: { code: string } | null }[] }[] };

test("create, design, fill, publish and archive an announcement bar", async ({ page, request }) => {
  const code = `E2EANN${Date.now().toString(36).toUpperCase()}`;
  const created = await request.post("/api/v1/admin/coupons", {
    data: { code, name: "e2e announcement", kind: "percent", value: 15, is_active: true, per_customer_limit: 1 },
    headers: fingerprint,
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const coupon = (await created.json()) as { promotion_id: string };
  let barId: string | null = null;

  try {
    await page.goto("/marketing/announcements");
    await page.getByRole("button", { name: /^(New bar|شريط جديد)$/ }).click();
    await expect(page).toHaveURL(/\/marketing\/announcements\/[0-9a-f-]{36}$/);
    barId = page.url().split("/").pop() ?? null;

    // Design + name, then save the settings.
    await page.getByRole("button", { name: /^(Sale|خصم) 30%\s*(Sunset|غروب)$/ }).click();
    await page.locator("#bar-name").fill(`e2e bar ${code}`);
    await page.getByRole("button", { name: /^(Save settings|حفظ الإعدادات)$/ }).click();
    await expect(page.getByRole("button", { name: /^(Save settings|حفظ الإعدادات)$/ })).toBeDisabled();

    // One coupon item.
    await page.getByRole("button", { name: /^(Add item|إضافة عنصر)$/ }).click();
    const dialog = page.locator(".ma-modal");
    await dialog.locator("#item-text-ar").fill("خصم اختبار على كل الدورات");
    await dialog.getByRole("button", { name: /^(Pick a coupon|اختر كوبوناً)$/ }).click();
    await page.getByRole("listbox").getByRole("option", { name: new RegExp(code) }).click();
    await expect(dialog.locator("#item-highlight-ar")).toHaveValue("خصم 15%");
    await dialog.getByRole("button", { name: /^(Save item|حفظ العنصر)$/ }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator(".ma-ann-item")).toContainText(code);

    // The live preview (storefront iframe) renders the item.
    const frame = page.frameLocator(".ma-ann-preview iframe");
    await expect(frame.locator("section.ma-announce")).toContainText("خصم اختبار على كل الدورات", { timeout: 20_000 });

    await page.getByRole("button", { name: /^(Publish|نشر)$/ }).click();
    await expect(page.getByText(/^(Live|منشور)$/).first()).toBeVisible();

    const live = await request.get("/api/v1/announcements/active", { headers: fingerprint });
    expect(live.ok()).toBeTruthy();
    const bar = ((await live.json()) as PublicBars).bars.find((b) => b.id === barId);
    expect(bar, "published bar is served publicly").toBeTruthy();
    expect(bar!.style.bg.colors).toHaveLength(3); // Sunset preset
    expect(bar!.items[0].coupon?.code).toBe(code);
  } finally {
    if (barId) {
      await request.put(`/api/v1/admin/announcements/${barId}/status`, { data: { status: "archived" }, headers: fingerprint });
    }
    await request.delete(`/api/v1/admin/coupons/${coupon.promotion_id}`, { headers: fingerprint });
  }
});

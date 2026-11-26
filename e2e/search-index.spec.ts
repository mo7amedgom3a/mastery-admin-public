import { expect, test } from "@playwright/test";

/**
 * Settings → Content indexing (`/settings/search-index`) against the running dev stack: the vector
 * index overview, the live keyword test (raw chunks, storefront results, expected-product check)
 * and re-indexing one product. Needs the RAG worker and Vectorize configured in the backend .env.
 */
test.describe("content indexing console", () => {
  test("shows the index, live-tests a keyword and re-indexes one product", async ({ page }) => {
    await page.goto("/settings/search-index");
    await expect(page.getByRole("heading", { name: /فهرسة المحتوى|Content indexing/ })).toBeVisible();
    await expect(page.getByTestId("index-kpis")).toBeVisible();
    await expect(page.getByTestId("index-products").locator("tbody tr").first()).toBeVisible({ timeout: 20_000 });

    // Expected product: pick the Excel course through the product search.
    await page.getByLabel(/المنتجات المتوقعة|Expected products/).fill("أكسيل");
    const picker = page.getByTestId("live-test-picker");
    await expect(picker.getByRole("button").first()).toBeVisible({ timeout: 15_000 });
    await picker.getByRole("button").first().click();

    await page.getByTestId("live-test-query").fill("excel");
    await page.getByRole("button", { name: /^(اختبار|Test)$/ }).click();
    const result = page.getByTestId("live-test-result");
    await expect(result).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("live-test-chunks").locator("tbody tr").first()).toBeVisible();
    await expect(page.getByTestId("live-test-expectations")).toContainText(/ظهر|Matched/);

    // Re-index the first product row and follow the run.
    const firstRow = page.getByTestId("index-products").locator("tbody tr").first();
    await firstRow.getByRole("button", { name: /^(إعادة|فهرسة|Re-index|Index)$/ }).click();
    const detail = page.getByTestId("index-run-detail");
    await expect(detail).toBeVisible({ timeout: 20_000 });
    await expect(detail).toContainText(/قيد التنفيذ|اكتمل|Running|Completed/, { timeout: 60_000 });
  });
});

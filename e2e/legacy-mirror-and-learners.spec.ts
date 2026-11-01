import { execFileSync } from "node:child_process";

import { expect, test } from "@playwright/test";

import { fingerprint } from "./support";

/*
 * Settings → General: the LMS mirror refresh, through the live API and legacy sync worker. It really reads production
 * (read only) and writes the local mirror. Learners: the "joined a course or diploma" filter against the database.
 * Local database only. Needs QA_*, SA_PASSWORD and LEGACY_MIRROR_REFRESH_ENABLED=true.
 */

function sql(statement: string): string {
  return execFileSync("docker", [
    "exec", "mssql_db", "/opt/mssql-tools18/bin/sqlcmd", "-C", "-I", "-b", "-h", "-1", "-W", "-S", "localhost",
    "-U", "sa", "-P", process.env.SA_PASSWORD ?? "", "-d", "mastery_b2c_dev", "-Q", `SET NOCOUNT ON; ${statement}`,
  ], { encoding: "utf-8" }).trim();
}

const joined = (types: string) => sql(`SELECT COUNT(DISTINCT e.customer_id) FROM b2c.entitlements e JOIN b2c.products p ON p.product_id = e.product_id WHERE p.product_type IN (${types})`);

test("the learners list filters by course or diploma", async ({ page, request }) => {
  const total = async (params: Record<string, string>) => {
    const response = await request.get("/api/v1/admin/customers", { params: { limit: "1", ...params }, headers: fingerprint });
    expect(response.ok(), await response.text()).toBeTruthy();
    return String(((await response.json()) as { total: number }).total);
  };
  expect(await total({ enrolled_in: "any" })).toBe(joined("N'course', N'diploma'"));
  expect(await total({ enrolled_in: "course" })).toBe(joined("N'course'"));
  expect(await total({ enrolled_in: "diploma" })).toBe(joined("N'diploma'"));
  expect((await request.get("/api/v1/admin/customers", { params: { enrolled_in: "bad" }, headers: fingerprint })).status()).toBe(422);

  await page.goto("/customers");
  const filter = page.getByRole("combobox").filter({ hasText: /كل المتعلمين|All learners/ }).first();
  await expect(filter).toBeVisible({ timeout: 30_000 });
  const listed = page.waitForResponse((r) => r.url().includes("enrolled_in=diploma") && r.ok());
  await filter.click();
  await page.getByRole("option", { name: /منضم إلى دبلومة|In a diploma/ }).click();
  expect((await (await listed).json() as { total: number }).total).toBe(Number(joined("N'diploma'")));
});

test("settings refreshes the LMS mirror and applies the sync", async ({ page }) => {
  test.setTimeout(420_000);
  await page.goto("/settings/general");
  const card = page.getByTestId("mirror-card");
  await expect(card).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /تحديث من الإنتاج|Refresh from production/ }).click();
  await page.getByRole("button", { name: /بدء التحديث|Start refresh/ }).click();
  await expect(page.getByTestId("mirror-status")).toHaveText(/Copying|جارٍ النسخ|Applying|جارٍ تطبيق/, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /جارٍ التحديث|Refreshing/ })).toBeDisabled();
  await expect(page.getByTestId("mirror-status")).toHaveText(/Completed|اكتمل/, { timeout: 390_000 });
  expect(sql("SELECT TOP 1 status FROM b2c.legacy_mirror_runs ORDER BY started_at DESC")).toBe("succeeded");
  expect(sql("SELECT COUNT(*) FROM b2c.audit_logs WHERE action = N'legacy_mirror.refresh_requested'")).not.toBe("0");
});

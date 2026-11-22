import { expect, test } from "@playwright/test";

/**
 * Read-only smoke test for the Studio Flow canvases. It discovers an engine, a lab and a scenario
 * through the API, opens their Flow views and asserts that React Flow rendered. It never writes.
 */
test.describe("labs flow canvas", () => {
  test("engine lifecycle flow renders", async ({ page }) => {
    const response = await page.request.get("/api/v1/admin/labs/engine-defs?system=false");
    expect(response.ok(), await response.text()).toBeTruthy();
    const body = (await response.json()) as { items?: { engine_id: string }[] };
    const engine = body.items?.[0];
    test.skip(!engine, "No admin engine in the dev data");

    await page.goto(`/learning/labs/engines/${engine.engine_id}?tab=flow`);
    await expect(page.getByTestId("flow-canvas")).toBeVisible();
    await expect(page.getByTestId("flow-node").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("flow-inspector")).toBeVisible();
  });

  test("lab flow and scenario preview render", async ({ page }) => {
    const list = await page.request.get("/api/v1/admin/labs?limit=1");
    expect(list.ok(), await list.text()).toBeTruthy();
    const pageBody = (await list.json()) as { items?: { lab_id: string }[] };
    const lab = pageBody.items?.[0];
    test.skip(!lab, "No lab in the dev data");

    await page.goto(`/learning/labs/${lab.lab_id}/edit?tab=flow`);
    await expect(page.getByTestId("flow-canvas")).toBeVisible();
    await expect(page.getByTestId("flow-node").first()).toBeVisible({ timeout: 15_000 });

    const detail = await page.request.get(`/api/v1/admin/labs/${lab.lab_id}`);
    expect(detail.ok(), await detail.text()).toBeTruthy();
    const detailBody = (await detail.json()) as { scenarios?: { scenario_id: string }[] };
    const scenario = detailBody.scenarios?.[0];
    test.skip(!scenario, "No scenario in the dev data");

    await page.goto(`/learning/labs/${lab.lab_id}/edit?tab=scenarios&scenario=${scenario.scenario_id}`);
    await page.getByRole("button", { name: /معاينة المسار|Flow preview/ }).click();
    await expect(page.getByTestId("flow-canvas")).toBeVisible();
    await expect(page.getByTestId("flow-inspector")).toBeVisible();
  });
});

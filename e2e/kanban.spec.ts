import { test, expect, type Page } from "@playwright/test";

const orderRef = "b2c:00000000-0000-0000-0000-000000000001";
const companyId = "00000000-0000-0000-0000-000000000002";

async function fixtures(page: Page, { readOnly = false, rtl = false, many = false } = {}) {
  let orderStage = "new", companyStage = "new";
  let fail = false;
  let gate: Promise<void> | null = null;
  let release: (() => void) | undefined;
  const requests: URL[] = [];
  const mutations: { path: string; body: Record<string, string> }[] = [];
  await page.addInitScript((lang) => localStorage.setItem("admin.lang", lang), rtl ? "ar" : "en");
  const order = () => ({ ref: orderRef, source: "b2c", status: "pending_payment", payment_status: "pending",
    customer_email: "buyer@example.test", amount_minor: 12500, currency_code: "SAR", created_at: "2026-11-01T10:00:00Z",
    follow_up_status: orderStage, invoice_count: 0, lines: [], transactions: [], invoices: [] });
  const company = () => ({ request_id: companyId, name: "Company Contact", email: "contact@example.test", company_name: "Acme Training",
    status: companyStage, submitted_at: "2026-11-01T10:00:00Z", assigned_admin_id: null, form_state: "in_progress", payload: {} });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = decodeURIComponent(url.pathname.replace("/api/v1/", ""));
    const method = route.request().method();
    const reply = (body: unknown, status = 200) => route.fulfill({ json: body, status });
    if (path === "admin/me") return reply({ admin_user_id: companyId, email: "admin@example.test", full_name: "Test Admin", status: "active",
      scopes: readOnly ? ["admin:orders:read", "admin:catalog:read", "admin:operations:read"] : ["*"] });
    if (method === "PATCH") {
      const body = route.request().postDataJSON();
      mutations.push({ path, body });
      if (gate) await gate;
      if (fail) return reply({ detail: "Save failed for test" }, 500);
      if (path.endsWith("/follow-up")) { orderStage = body.follow_up_status; return reply(order()); }
      companyStage = body.status; return reply(company());
    }
    if (path === "admin/orders") {
      requests.push(url);
      const stage = url.searchParams.get("follow_up_status");
      let items = !stage || stage === orderStage ? [order()] : [];
      if (many && items.length) items = Array.from({ length: 26 }, (_, i) => ({ ...order(), ref: i ? `legacy:order:${i}` : orderRef, source: i ? "legacy" : "b2c" }));
      const offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 25);
      return reply({ items: items.slice(offset, offset + limit), total: items.length, offset, limit });
    }
    if (path.startsWith("admin/orders/")) return reply(order());
    if (path === "admin/requests/company-training") {
      requests.push(url);
      const stage = url.searchParams.get("status");
      const items = !stage || stage === companyStage ? [company()] : [];
      return reply({ items, total: items.length, offset: 0, limit: 25 });
    }
    if (path.startsWith("admin/requests/stats/")) return reply({ total: 1, in_progress: 1, by_status: [], by_month: [], categories: [], skills: [], by_step: [], skills_request_count: 0 });
    if (path === "admin/requests/assignees" || path === "catalog/categories") return reply([]);
    if (path === "catalog/onboarding-options") return reply({ skills: [] });
    if (path.endsWith("/notes") || path.endsWith("/attachments")) return reply([]);
    if (path === `admin/requests/${companyId}`) return reply(company());
    return reply({ items: [], total: 0 });
  });
  return { requests, mutations, failNext: () => { fail = true; },
    holdNext: () => { gate = new Promise<void>((resolve) => { release = resolve; }); },
    release: () => { release?.(); gate = null; } };
}
const column = (page: Page, stage: string) => page.locator(`.ma-board-column[data-stage="${stage}"]`);
const card = (page: Page, id: string) => page.locator(`[data-card-id="${id}"]`);

test("sales menu moves persist across reload and order details", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto("/sales/orders");
  await expect(column(page, "new").getByText("buyer@example.test")).toBeVisible();
  await card(page, orderRef).getByRole("combobox", { name: "Move to" }).selectOption("in_progress");
  await expect(column(page, "in_progress").getByText("buyer@example.test")).toBeVisible();
  await expect(card(page, orderRef)).toHaveAttribute("aria-busy", "false");
  expect(state.mutations[0].body).toEqual({ follow_up_status: "in_progress" });
  await page.reload();
  await expect(column(page, "in_progress").getByText("buyer@example.test")).toBeVisible();
  await card(page, orderRef).getByRole("link").click();
  await expect(page.getByRole("combobox", { name: "Follow-up status" })).toHaveValue("in_progress");
});

test("company drag moves persist and keep form completion independent", async ({ page }) => {
  const state = await fixtures(page);
  await page.setViewportSize({ width: 1800, height: 1200 });
  await page.goto("/companies");
  await expect(card(page, companyId).getByText("Form incomplete")).toBeVisible();
  await card(page, companyId).getByRole("button", { name: "Drag to move card" }).dragTo(column(page, "closed"));
  await expect(column(page, "closed").getByText("Acme Training")).toBeVisible();
  await expect(card(page, companyId)).toHaveAttribute("aria-busy", "false");
  expect(state.mutations[0].body).toEqual({ status: "closed" });
  await page.reload();
  await expect(column(page, "closed").getByText("Form incomplete")).toBeVisible();
  await card(page, companyId).getByRole("link", { name: "Acme Training" }).click();
  await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveValue("closed");
});

for (const kind of ["sales", "company"] as const) {
  test(`${kind} failed move rolls back and shows error`, async ({ page }) => {
    const state = await fixtures(page);
    await page.goto(kind === "sales" ? "/sales/orders" : "/companies");
    const id = kind === "sales" ? orderRef : companyId;
    state.failNext();
    await card(page, id).getByRole("combobox", { name: "Move to" }).selectOption(kind === "sales" ? "failure" : "closed");
    await expect(page.getByText("Save failed for test")).toBeVisible();
    await expect(column(page, "new").locator(`[data-card-id="${id}"]`)).toBeVisible();
    await expect(card(page, id)).toHaveAttribute("aria-busy", "false");
  });
}

test("sales board loads per column and preserves search when switching to table", async ({ page }) => {
  const state = await fixtures(page, { many: true });
  await page.goto("/sales/orders");
  await expect(column(page, "new").locator("article")).toHaveCount(25);
  await column(page, "new").getByRole("button", { name: "Load more" }).click();
  await expect(column(page, "new").locator("article")).toHaveCount(26);
  const search = page.getByPlaceholder("Search customer email…");
  await search.fill("buyer");
  await search.press("Enter");
  await expect.poll(() => state.requests.some((url) => url.searchParams.get("query") === "buyer" && url.searchParams.has("follow_up_status"))).toBeTruthy();
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(search).toHaveValue("buyer");
  await expect(page.getByRole("combobox", { name: "Follow-up status" }).first()).toHaveValue("new");
  await expect.poll(() => state.requests.some((url) => url.searchParams.get("query") === "buyer" && !url.searchParams.has("follow_up_status"))).toBeTruthy();
});

test("company filters persist between board and table", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto("/companies");
  await page.getByPlaceholder("Name, email or company").fill("Acme");
  await page.getByRole("combobox", { name: "Form completion", exact: true }).selectOption("in_progress");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  await expect(page.getByPlaceholder("Name, email or company")).toHaveValue("Acme");
  await expect.poll(() => state.requests.some((url) => url.searchParams.get("query") === "Acme" && url.searchParams.get("form_state") === "in_progress")).toBeTruthy();
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(card(page, companyId)).toBeVisible();
});

test("read-only admins see cards without move controls", async ({ page }) => {
  await fixtures(page, { readOnly: true });
  await page.goto("/sales/orders");
  await expect(card(page, orderRef)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Move to" })).toHaveCount(0);
  await page.goto("/companies");
  await expect(card(page, companyId)).toBeVisible();
  await expect(page.getByRole("button", { name: "Drag to move card" })).toHaveCount(0);
});

test("Arabic boards fit narrow screens and allow touch-menu moves", async ({ page }) => {
  await fixtures(page, { rtl: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sales/orders");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(card(page, orderRef)).toBeVisible();
  await card(page, orderRef).getByRole("combobox", { name: "نقل إلى" }).selectOption("success");
  await expect(column(page, "success").locator("article")).toHaveCount(1);
  const overflow = await page.locator(".ma-board").evaluate((el) => el.scrollWidth > el.clientWidth);
  expect(overflow).toBeTruthy();
});


test("optimistic moves update counts and block repeated saves", async ({ page }) => {
  const state = await fixtures(page);
  await page.goto("/sales/orders");
  await expect(card(page, orderRef)).toBeVisible();
  state.holdNext();
  await card(page, orderRef).getByRole("combobox", { name: "Move to" }).selectOption("success");
  await expect(column(page, "success").locator("article")).toHaveCount(1);
  await expect(column(page, "new").locator("article")).toHaveCount(0);
  await expect(column(page, "success").locator(".ma-board-column-head .ma-tag")).toHaveText("1");
  await expect(column(page, "new").locator(".ma-board-column-head .ma-tag")).toHaveText("0");
  await expect(card(page, orderRef).getByRole("combobox", { name: "Move to" })).toBeDisabled();
  expect(state.mutations).toHaveLength(1);
  state.release();
  await expect(card(page, orderRef)).toHaveAttribute("aria-busy", "false");
});

for (const kind of ["sales", "company"] as const) {
  test(`${kind} cards drag from their body and linked title into another column`, async ({ page }) => {
    const state = await fixtures(page);
    const id = kind === "sales" ? orderRef : companyId;
    const destination = kind === "sales" ? "in_progress" : "in_review";
    await page.goto(kind === "sales" ? "/sales/orders" : "/companies");
    await expect(card(page, id)).toHaveAttribute("draggable", "true");
    await card(page, id).dragTo(column(page, destination));
    await expect(column(page, destination).locator(`[data-card-id="${id}"]`)).toHaveAttribute("aria-busy", "false");
    expect(state.mutations).toHaveLength(1);
    // A title link must start a board drag rather than the browser's native URL drag.
    await card(page, id).getByRole("link").first().dragTo(column(page, "new"));
    await expect(column(page, "new").locator(`[data-card-id="${id}"]`)).toHaveAttribute("aria-busy", "false");
    expect(state.mutations).toHaveLength(2);
    await card(page, id).getByRole("link").first().click();
    await expect(page).toHaveURL(kind === "sales" ? /\/sales\/orders\// : /\/companies\//);
  });
}

test("dragging near the board edge scrolls toward off-screen columns", async ({ page }) => {
  await fixtures(page);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto("/sales/orders");
  const dragged = card(page, orderRef);
  await dragged.scrollIntoViewIfNeeded();
  const start = await dragged.boundingBox();
  const board = await page.locator(".ma-board").boundingBox();
  if (!start || !board) throw new Error("Board or card is missing");
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 15, start.y + start.height / 2, { steps: 5 });
  await page.mouse.move(board.x + board.width - 10, start.y + start.height / 2, { steps: 10 });
  await expect.poll(() => page.locator(".ma-board").evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".ma-board-column--over")).toHaveCount(0);
});

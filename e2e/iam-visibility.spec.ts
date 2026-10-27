import { expect, test, type APIRequestContext, type Browser, type Page } from "@playwright/test";

import { qaCustomerRef } from "./support";
import {
  apiAs,
  expectStatus,
  IamWorld,
  me,
  NO_PERMISSION,
  ok,
  pageAs,
  railDomains,
  run,
  type Persona,
  type Policy,
  sessionFingerprint,
} from "./iam-support";

// Own rate-limit bucket: the default fingerprint is shared by every browser on this machine.
test.use({ extraHTTPHeaders: sessionFingerprint() });

/*
 * What each persona can see and do. The rail shows only the domains their scopes open, direct URLs
 * to hidden domains, hidden pages and write-only pages show the no-permission state, read-only
 * admins get no write buttons, and the API agrees: the same write is 403 for a reader and allowed
 * for a writer. A permission boundary caps a broad grant, and `own` record conditions hide another
 * admin's coupons.
 */

let world: IamWorld;
let readOnly: Policy;
let agent: Persona; // sales-read-only via the team + a direct orders write policy
let marketer: Persona; // marketer-read-only
let bounded: Persona; // sales-manager capped by a sales-read-only boundary
let ownerA: Persona; // marketer-manager, own records
let ownerB: Persona; // marketer-manager, own records
const NO_ORDER = "b2c:00000000-0000-0000-0000-000000000000";

// One signed-in browser session per persona, reused by every test (fewer logins).
const pages = new Map<Persona, Page>();
async function pageFor(browser: Browser, persona: Persona): Promise<Page> {
  if (!pages.has(persona)) pages.set(persona, await pageAs(browser, persona.email));
  return pages.get(persona)!;
}

test.describe.serial("IAM: visibility and least privilege per persona", () => {
  test.beforeAll(async () => {
    world = await IamWorld.create();
    readOnly = await world.template("sales-read-only");
    const manager = await world.template("sales-manager");
    const marketing = await world.template("marketer-read-only");
    const marketingManager = await world.template("marketer-manager");
    const ordersWrite = await world.policy("vis-orders-write", ["admin:orders:read", "admin:orders:write"]);
    const team = await world.team("vis-sales");
    await world.attachToTeam(team, readOnly);

    agent = await world.user("vis-agent", { teams: [team], policies: [ordersWrite] });
    marketer = await world.user("vis-marketer", { policies: [marketing] });
    bounded = await world.user("vis-bounded", { policies: [manager], boundary: readOnly });
    ownerA = await world.user("vis-owner-a", { policies: [marketingManager], resourceScope: "own" });
    ownerB = await world.user("vis-owner-b", { policies: [marketingManager], resourceScope: "own" });
  });

  test.afterAll(async () => {
    for (const page of pages.values()) await page.context().close();
    await world.cleanup();
  });

  test("the rail shows exactly the domains each persona's scopes open", async ({ browser }) => {
    const expected: [Persona, string[]][] = [
      [agent, ["Sales", "Customers", "Analytics"]],
      [marketer, ["Marketing"]],
      [bounded, ["Sales", "Customers", "Analytics"]],
    ];
    for (const [persona, domains] of expected) {
      const page = await pageFor(browser, persona);
      await page.goto("/");
      expect(await railDomains(page), persona.name).toEqual(domains);
    }
  });

  test("direct URLs to hidden domains, pages and write-only pages are blocked", async ({ browser }) => {
    const blocked: [Persona, string][] = [
      [marketer, "/sales/orders"],
      [marketer, "/customers"],
      [marketer, "/sales/coupons/new"], // marketing reader: coupons yes, creating them no
      [agent, "/marketing/affiliates"],
      [agent, "/access/users"],
      [agent, "/learning/courses/new"],
      [bounded, "/dashboard"], // sales-manager grants operations, the boundary removes it
      [bounded, "/settings/general"],
    ];
    for (const [persona, path] of blocked) {
      const page = await pageFor(browser, persona);
      await page.goto(path);
      await expect(page.getByText(NO_PERMISSION), `${persona.name} → ${path}`).toBeVisible();
    }

    const page = await pageFor(browser, ownerA);
    await page.goto("/sales/coupons/new");
    await expect(page.locator("nav.ma-rail")).toBeVisible();
    await expect(page.getByText(NO_PERMISSION)).toHaveCount(0);
  });

  test("read-only personas get no write buttons; writers do", async ({ browser, request }) => {
    const customerRef = await qaCustomerRef(request);

    const reader = await pageFor(browser, agent);
    await reader.goto(`/customers/${encodeURIComponent(customerRef)}`);
    await expect(reader.getByRole("heading").first()).toBeVisible();
    await expect(reader.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await expect(reader.getByRole("button", { name: "Grant access" })).toHaveCount(0);

    const marketingReader = await pageFor(browser, marketer);
    await marketingReader.goto("/sales/coupons");
    await expect(marketingReader.getByRole("heading", { name: /Coupons/ }).first()).toBeVisible();
    await expect(marketingReader.getByRole("link", { name: "Create coupon" })).toHaveCount(0);

    const marketingWriter = await pageFor(browser, ownerA);
    await marketingWriter.goto("/sales/coupons");
    await expect(marketingWriter.getByRole("link", { name: "Create coupon" })).toBeVisible();
  });

  test("the API agrees: the same write is 403 for readers and allowed for writers", async () => {
    const apis = new Map<Persona, APIRequestContext>();
    for (const persona of [agent, marketer, bounded]) apis.set(persona, await apiAs(persona.email));

    // orders:write passes the scope check and fails on the missing order instead.
    const writer = await apis.get(agent)!.post(`/api/v1/admin/orders/${NO_ORDER}/cancel`);
    expect(writer.status(), "orders:write must pass the scope check").not.toBe(403);
    expectStatus(await apis.get(bounded)!.post(`/api/v1/admin/orders/${NO_ORDER}/cancel`), 403);
    expectStatus(await apis.get(marketer)!.post(`/api/v1/admin/orders/${NO_ORDER}/cancel`), 403);
    expectStatus(
      await apis.get(marketer)!.post("/api/v1/admin/coupons", { data: { code: `E2EX${run}`, kind: "percent", value: 5 } }),
      403,
    );
    expectStatus(await apis.get(agent)!.get("/api/v1/admin/iam/users"), 403);
    for (const api of apis.values()) await api.dispose();
  });

  test("a permission boundary caps the effective scopes", async () => {
    const api = await apiAs(bounded.email);
    const profile = await me(api);
    expect(profile.scopes.sort()).toEqual([...readOnly.scopes].sort());
    expect(profile.granted_scopes).toContain("admin:orders:write");
    expect(profile.boundary_scopes?.sort()).toEqual([...readOnly.scopes].sort());
    await api.dispose();
  });

  test("`own` record conditions hide another admin's coupons", async ({ request }) => {
    const a = await apiAs(ownerA.email);
    const b = await apiAs(ownerB.email);
    const code = `E2EOWN${run}`.toUpperCase();
    const coupon = await ok<{ promotion_id: string }>(
      await a.post("/api/v1/admin/coupons", { data: { code, kind: "percent", value: 5, is_active: false } }),
    );
    world.coupons.push(coupon.promotion_id);

    await ok(await a.get(`/api/v1/admin/coupons/${coupon.promotion_id}`));
    expectStatus(await b.get(`/api/v1/admin/coupons/${coupon.promotion_id}`), 403);
    const listed = await ok<{ items: { promotion_id: string }[] }>(
      await b.get("/api/v1/admin/coupons", { params: { query: code, limit: 50 } }),
    );
    expect(listed.items.map((item) => item.promotion_id)).not.toContain(coupon.promotion_id);
    // The super admin (condition `all`) still sees it.
    await ok(await request.get(`/api/v1/admin/coupons/${coupon.promotion_id}`));
    await a.dispose();
    await b.dispose();
  });
});

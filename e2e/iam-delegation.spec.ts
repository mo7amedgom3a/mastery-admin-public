import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";

import {
  apiAs,
  expectStatus,
  IamWorld,
  me,
  ok,
  pageAs,
  type Persona,
  type Policy,
  type Team,
  sessionFingerprint,
} from "./iam-support";

// Own rate-limit bucket: the default fingerprint is shared by every browser on this machine.
test.use({ extraHTTPHeaders: sessionFingerprint() });

/*
 * Delegated administration: a sales team lead manages only their own team, inside their own scope
 * boundary. They create a member, grant and revoke policies, cap the member with a permission
 * boundary and suspend/reactivate them; every escalation or cross-team attempt is refused by the API.
 */

let world: IamWorld;
let readOnly: Policy;
let leadPolicy: Policy;
let superPolicy: Policy;
let sales: Team;
let support: Team;
let lead: Persona;
let otherLead: Persona;
let member: Persona;
let outsider: Persona;
let leadApi: APIRequestContext;

test.describe.serial("IAM: a team lead manages their own team", () => {
  test.beforeAll(async () => {
    world = await IamWorld.create();
    readOnly = await world.template("sales-read-only");
    leadPolicy = await world.template("sales-team-lead");
    superPolicy = await world.template("super_admin");
    sales = await world.team("sales");
    support = await world.team("support");
    await world.attachToTeam(sales, readOnly, "team");
    lead = await world.user("sales-lead", { policies: [leadPolicy], teams: [sales], leadOf: [sales] });
    otherLead = await world.user("support-lead", { policies: [leadPolicy], teams: [support], leadOf: [support] });
    outsider = await world.user("support-agent", { teams: [support] });
    leadApi = await apiAs(lead.email);
  });

  test.afterAll(async () => {
    await leadApi?.dispose();
    await world.cleanup();
  });

  test("the lead sees only their team, scoped KPIs and Access in the rail", async ({ browser }) => {
    const page = await pageAs(browser, lead.email);
    await page.goto("/access/teams");
    await expect(page.getByText("Management scope: your teams only")).toBeVisible();
    await expect(page.getByText("Your teams", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: sales.name })).toBeVisible();
    await expect(page.getByRole("button", { name: support.name })).toHaveCount(0);
    // Super-admin-only controls stay hidden.
    await expect(page.getByRole("button", { name: "New team" })).toHaveCount(0);

    const users = await ok<{ items: { email: string }[] }>(
      await leadApi.get("/api/v1/admin/iam/users", { params: { limit: 200 } }),
    );
    const emails = users.items.map((item) => item.email);
    expect(emails).toContain(lead.email);
    expect(emails).not.toContain(outsider.email);
    await page.context().close();
  });

  test("the lead creates a member inside their team and boundary", async () => {
    member = await world.user("sales-agent", { as: leadApi, teams: [sales], policies: [readOnly] });
    const created = await ok<{ group_ids: string[]; scopes: string[] }>(
      await leadApi.get(`/api/v1/admin/iam/users/${member.id}`),
    );
    expect(created.group_ids).toContain(sales.group_id);
    expect(created.scopes.sort()).toEqual([...readOnly.scopes].sort());
  });

  test("escalation and cross-team attempts are refused", async () => {
    // Grant a policy broader than the lead's own scopes.
    expectStatus(
      await leadApi.post(`/api/v1/admin/iam/groups/${sales.group_id}/policies`, {
        data: { policy_id: superPolicy.policy_id, resource_scope: "all" },
      }),
      403,
    );
    // Mint a policy with a scope the lead lacks.
    expectStatus(
      await leadApi.post("/api/v1/admin/iam/policies", {
        data: { code: `e2e-too-broad-${Date.now()}`, name: "too broad", scopes: ["admin:payments:refund"] },
      }),
      403,
    );
    // Another team's members, policies and trace.
    expectStatus(
      await leadApi.post(`/api/v1/admin/iam/groups/${support.group_id}/members`, { data: { admin_user_id: member.id } }),
      403,
    );
    expectStatus(
      await leadApi.post(`/api/v1/admin/iam/groups/${support.group_id}/policies`, {
        data: { policy_id: readOnly.policy_id, resource_scope: "all" },
      }),
      403,
    );
    expectStatus(await leadApi.get(`/api/v1/admin/iam/admin-users/${outsider.id}/trace`), 403);
    // Account changes: self, another lead, someone outside the team.
    for (const target of [lead, otherLead, outsider]) {
      expectStatus(
        await leadApi.post(`/api/v1/admin/iam/users/${target.id}/status`, { data: { status: "suspended" } }),
        403,
      );
    }
    // Appointing a lead and editing a system template are super-admin only.
    expectStatus(
      await leadApi.patch(`/api/v1/admin/iam/groups/${sales.group_id}`, { data: { lead_admin_user_id: member.id } }),
      403,
    );
    const template = await leadApi.patch(`/api/v1/admin/iam/policies/${readOnly.policy_id}`, { data: { name: "hijack" } });
    expect([403, 409]).toContain(template.status());
  });

  test("the lead grants and revokes a policy on their member", async () => {
    const attachment = await ok<{ attachment_id: string }>(
      await leadApi.post(`/api/v1/admin/iam/admin-users/${member.id}/policies`, {
        data: { policy_id: leadPolicy.policy_id, resource_scope: "own" },
      }),
    );
    let user = await ok<{ scopes: string[] }>(await leadApi.get(`/api/v1/admin/iam/users/${member.id}`));
    expect(user.scopes).toContain("admin:iam:manage");

    await ok(await leadApi.delete(`/api/v1/admin/iam/admin-users/${member.id}/policies/${attachment.attachment_id}`));
    user = await ok<{ scopes: string[] }>(await leadApi.get(`/api/v1/admin/iam/users/${member.id}`));
    expect(user.scopes).not.toContain("admin:iam:manage");
  });

  test("the lead grants single scopes individually, only ones they hold", async () => {
    const path = `/api/v1/admin/iam/users/${member.id}/inline-policy`;
    expectStatus(await leadApi.put(path, { data: { scopes: ["admin:payments:refund"] } }), 403);
    const user = await ok<{ scopes: string[] }>(
      await leadApi.put(path, { data: { scopes: ["admin:audit:read"], resource_scope: "own" } }),
    );
    expect(user.scopes).toContain("admin:audit:read");
    expect(await ok(await leadApi.get(path))).toEqual({ scopes: ["admin:audit:read"], resource_scope: "own" });
    // Not reachable as a named policy, and outside the lead's team it is refused.
    expectStatus(await leadApi.put(`/api/v1/admin/iam/users/${outsider.id}/inline-policy`, { data: { scopes: [] } }), 403);
    await ok(await leadApi.put(path, { data: { scopes: [] } }));
    expect((await ok<{ scopes: string[] }>(await leadApi.get(`/api/v1/admin/iam/users/${member.id}`))).scopes).not.toContain(
      "admin:audit:read",
    );
  });

  test("the lead caps a member with a boundary and cannot lift it", async ({ request }) => {
    const capped = await world.policy("orders-only", ["admin:orders:read"]);
    // The lead holds admin:orders:read, so this boundary is inside their own scopes.
    const user = await ok<Required<Pick<import("./iam-support").Me, "scopes" | "granted_scopes">>>(
      await leadApi.put(`/api/v1/admin/iam/users/${member.id}/boundary`, { data: { policy_id: capped.policy_id } }),
    );
    expect(user.scopes).toEqual(["admin:orders:read"]);
    expect(user.granted_scopes.length).toBeGreaterThan(1);

    const memberApi = await apiAs(member.email);
    expect((await me(memberApi)).scopes).toEqual(["admin:orders:read"]);
    expectStatus(await memberApi.get("/api/v1/admin/customers", { params: { limit: 1 } }), 403);
    await memberApi.dispose();

    expectStatus(
      await leadApi.put(`/api/v1/admin/iam/users/${member.id}/boundary`, { data: { policy_id: null } }),
      403,
    );
    // The super admin lifts it so later checks start from the team policy again.
    await ok(
      await request.put(`/api/v1/admin/iam/users/${member.id}/boundary`, { data: { policy_id: null } }),
    );
  });

  test("the lead suspends a member: their session stops working; reactivation restores it", async () => {
    const memberApi = await apiAs(member.email);
    await ok(await memberApi.get("/api/v1/admin/me"));

    await ok(await leadApi.post(`/api/v1/admin/iam/users/${member.id}/status`, { data: { status: "suspended" } }));
    expectStatus(await memberApi.get("/api/v1/admin/me"), 401);
    await memberApi.dispose();

    await ok(await leadApi.post(`/api/v1/admin/iam/users/${member.id}/status`, { data: { status: "active" } }));
    const again = await apiAs(member.email);
    await ok(await again.get("/api/v1/admin/me"));
    await again.dispose();
  });

  test("the lead suspends a member from the team page", async ({ browser }) => {
    await suspendFromTeamPage(browser);
  });

  test("revoke removes the member from the team and suspends them", async () => {
    const revoked = await ok<{ status: string; group_ids: string[] }>(
      await leadApi.post(`/api/v1/admin/iam/users/${member.id}/revoke`),
    );
    expect(revoked.status).toBe("suspended");
    expect(revoked.group_ids).not.toContain(sales.group_id);
  });
});

async function suspendFromTeamPage(browser: Browser) {
  const page = await pageAs(browser, lead.email);
  await page.goto(`/access/teams/${sales.group_id}`);
  const row = page.locator(".ma-row", { hasText: member.email });
  await row.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(row.getByText("Suspended")).toBeVisible();
  await row.getByRole("button", { name: "Activate", exact: true }).click();
  await expect(row.getByText("Suspended")).toHaveCount(0);
  // The lead's own row and a lead never get account controls.
  await expect(page.locator(".ma-row", { hasText: lead.email }).getByRole("button", { name: "Suspend" })).toHaveCount(0);
  await page.context().close();
}

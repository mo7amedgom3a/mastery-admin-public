import { expect, test, type Page } from "@playwright/test";

import { IamWorld, ok, run, PASSWORD, type Me, type Policy, type Team, sessionFingerprint } from "./iam-support";

// Own rate-limit bucket: the default fingerprint is shared by every browser on this machine.
test.use({ extraHTTPHeaders: sessionFingerprint() });

/*
 * Access management as the super admin, through the dashboard: create a team, attach a policy to it,
 * create a member with the Add-user dialog, then on the user page attach a direct policy, set a
 * permission boundary and detach — checking the inherited and effective scopes the API reports.
 */

let world: IamWorld;
let readOnly: Policy;
let ordersWrite: Policy;
let team: Team;
let userId = "";
const email = `e2e+ui-member-${run}@example.test`;

async function pick(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("listbox", { name: label }).getByRole("option", { name: new RegExp(option) }).click();
}

async function userScopes(page: Page): Promise<string[]> {
  const user = await ok<Me>(await page.request.get(`/api/v1/admin/iam/users/${userId}`));
  return user.scopes;
}

test.describe.serial("IAM: super admin manages teams, users and policies", () => {
  test.beforeAll(async () => {
    world = await IamWorld.create();
    readOnly = await world.template("sales-read-only");
    ordersWrite = await world.policy("orders-write", ["admin:orders:read", "admin:orders:write"]);
  });

  test.afterAll(async () => {
    if (userId) world.users.push({ id: userId, email, name: "ui member" });
    await world.cleanup();
  });

  test.beforeEach(async ({ page }) => {
    // A fresh rate-limit bucket per test: each user page loads and refetches a lot.
    await page.context().setExtraHTTPHeaders(sessionFingerprint());
    await page.addInitScript(() => localStorage.setItem("admin.lang", "en"));
  });

  test("creates a team from the Teams tab", async ({ page }) => {
    await page.goto("/access/teams");
    await page.getByRole("button", { name: "New team" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#team-code").fill(`e2e-ui-${run}`);
    await dialog.locator("#team-name").fill(`e2e ui ${run}`);
    await dialog.getByRole("button", { name: "Create team" }).click();
    await expect(dialog).toBeHidden();

    const teams = await ok<{ items: Team[] }>(
      await page.request.get("/api/v1/admin/iam/groups", { params: { search: `e2e-ui-${run}` } }),
    );
    team = teams.items.find((item) => item.code === `e2e-ui-${run}`)!;
    expect(team).toBeTruthy();
    world.teams.push(team);
  });

  test("attaches a policy to the team; members inherit it", async ({ page }) => {
    await page.goto(`/access/teams/${team.group_id}`);
    await pick(page, "Attach policy", readOnly.name);
    await page.getByRole("button", { name: "Attach", exact: true }).click();
    await expect(page.getByText(readOnly.name).first()).toBeVisible();

    await page.getByRole("button", { name: "Create an admin" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#add-user-email").fill(email);
    await dialog.locator("#add-user-name").fill("e2e ui member");
    await dialog.locator("#add-user-password").fill(PASSWORD);
    await dialog.getByRole("button", { name: "Create user" }).click();
    await expect(dialog.getByText("Sign-in details")).toBeVisible();
    await dialog.getByRole("button", { name: "Done" }).click();

    const users = await ok<{ items: { admin_user_id: string; email: string; scopes: string[] }[] }>(
      await page.request.get("/api/v1/admin/iam/users", { params: { search: email } }),
    );
    const created = users.items.find((item) => item.email === email)!;
    userId = created.admin_user_id;
    expect(created.scopes.sort()).toEqual([...readOnly.scopes].sort());
  });

  test("attaches a direct policy, caps it with a boundary, then detaches it", async ({ page }) => {
    // Custom policies are outside the default choice list (templates + team policies) for this user.
    await ok(
      await page.request.post(`/api/v1/admin/iam/admin-users/${userId}/policies`, {
        data: { policy_id: ordersWrite.policy_id, resource_scope: "own" },
      }),
    );
    await page.goto(`/access/users/${userId}`);
    await expect(page.getByText(ordersWrite.name)).toBeVisible();
    await expect(page.getByText("admin:orders:write · own")).toBeVisible();
    expect(await userScopes(page)).toContain("admin:orders:write");

    // A boundary equal to the read-only template blocks the write scope.
    await pick(page, "Set boundary", readOnly.name);
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByText("Scopes blocked by the boundary")).toBeVisible();
    await expect(page.locator("code", { hasText: "admin:orders:write" })).toBeVisible();
    expect(await userScopes(page)).not.toContain("admin:orders:write");

    await page.getByRole("button", { name: "Remove boundary" }).click();
    await expect(page.getByText("No boundary")).toBeVisible();
    expect(await userScopes(page)).toContain("admin:orders:write");

    const direct = page.locator(".ma-row", { hasText: ordersWrite.name });
    await direct.getByRole("button", { name: "Detach" }).click();
    await expect(page.getByText("No direct policies.")).toBeVisible();
    expect((await userScopes(page)).sort()).toEqual([...readOnly.scopes].sort());
  });

  test("grants a single scope individually, without a policy", async ({ page }) => {
    await page.goto(`/access/users/${userId}`);
    const card = page.locator("section.ma-panel", { has: page.getByRole("heading", { name: /Individual permissions/ }) });
    await expect(card.getByText("No individual permissions.")).toBeVisible();
    await card.getByRole("button", { name: "Edit" }).click();
    await card.getByLabel(/admin:affiliates:manage/).check();
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.locator("code", { hasText: "admin:affiliates:manage" })).toBeVisible();

    expect(await userScopes(page)).toContain("admin:affiliates:manage");
    // Stored as the user's inline policy: not a named policy anyone can attach.
    const policies = await ok<{ items: { code: string }[] }>(
      await page.request.get("/api/v1/admin/iam/policies", { params: { search: "inline-", limit: 50 } }),
    );
    expect(policies.items).toEqual([]);
    await expect(page.getByText("No direct policies.")).toBeVisible();

    await card.getByRole("button", { name: "Edit" }).click();
    await card.getByLabel(/admin:affiliates:manage/).uncheck();
    await card.getByRole("button", { name: "Save" }).click();
    await expect(card.getByText("No individual permissions.")).toBeVisible();
    expect(await userScopes(page)).not.toContain("admin:affiliates:manage");
  });

  test("suspends and reactivates the account", async ({ page }) => {
    await page.goto(`/access/users/${userId}`);
    await page.getByRole("button", { name: "Suspend account" }).click();
    await expect(page.getByRole("button", { name: "Activate account" })).toBeVisible();
    await page.getByRole("button", { name: "Activate account" }).click();
    await expect(page.getByRole("button", { name: "Suspend account" })).toBeVisible();
  });
});

import { randomUUID } from "node:crypto";

import {
  expect,
  request as playwrightRequest,
  type APIRequestContext,
  type APIResponse,
  type Browser,
  type Page,
} from "@playwright/test";

/*
 * IAM personas for the access-management e2e specs. The QA super admin (the session saved by
 * `auth.setup.ts`) provisions throwaway teams, policies and admins with unique codes,
 * and `cleanup()` removes what can be removed: teams, custom policies, boundaries and coupons are
 * deleted; admin accounts cannot be deleted through the API, so they are revoked (suspended,
 * detached, removed from teams) instead.
 */

export const run = Date.now().toString(36);
export const PASSWORD = `E2e-${randomUUID()}`;

export type Me = {
  admin_user_id: string;
  email: string;
  scopes: string[];
  groups: string[];
  granted_scopes?: string[];
  boundary_scopes?: string[] | null;
};
export type Policy = { policy_id: string; code: string; name: string; scopes: string[] };
export type Team = { group_id: string; code: string; name: string; boundary_policy_id?: string | null };
export type Persona = { id: string; email: string; name: string };

export async function ok<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), `${response.url()} → ${response.status()} ${await response.text()}`).toBeTruthy();
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

export function expectStatus(response: APIResponse, status: number) {
  expect(response.status(), `${response.url()} → ${response.status()}`).toBe(status);
}

const baseURL = () => process.env.E2E_ADMIN_URL ?? "http://localhost:5173";

/*
 * Rate limits are keyed by client fingerprint, and `/auth/*` calls (login, the dashboard's session
 * refresh) share a small "sensitive" bucket. Each persona session therefore gets its own fingerprint,
 * and a login that still hits the limit waits for `Retry-After` and tries again.
 */
export const sessionFingerprint = () => ({ "X-Client-Fingerprint": `e2e-${randomUUID()}` });

/** Sends a request again while the rate limiter answers 429, waiting for `Retry-After`. */
async function patiently(send: () => Promise<APIResponse>): Promise<APIResponse> {
  for (let attempt = 0; ; attempt += 1) {
    const response = await send();
    if (response.status() !== 429 || attempt >= 5) return response;
    const wait = Number(response.headers()["retry-after"] ?? 10);
    await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 60) * 1000));
  }
}

async function login(api: APIRequestContext, email: string, password: string) {
  return ok(await patiently(() => api.post("/api/v1/admin/auth/login", { data: { email, password } })));
}

/** An API context signed in as `email` with a password (normal admin login, cookies kept). */
export async function apiAs(email: string, password = PASSWORD): Promise<APIRequestContext> {
  const api = await playwrightRequest.newContext({ baseURL: baseURL(), extraHTTPHeaders: sessionFingerprint() });
  await login(api, email, password);
  return api;
}

/** A browser page signed in as `email`, with the dashboard in English. */
export async function pageAs(browser: Browser, email: string, password = PASSWORD): Promise<Page> {
  const context = await browser.newContext({
    baseURL: baseURL(),
    storageState: undefined,
    extraHTTPHeaders: sessionFingerprint(),
  });
  await context.addInitScript(() => localStorage.setItem("admin.lang", "en"));
  const page = await context.newPage();
  await login(page.request, email, password);
  return page;
}

export async function me(api: APIRequestContext): Promise<Me> {
  return ok<Me>(await api.get("/api/v1/admin/me"));
}

/** The rail's domain titles, in order. */
export async function railDomains(page: Page): Promise<string[]> {
  const items = page.locator("nav.ma-rail a.ma-rail__item");
  await expect(items.first()).toBeVisible();
  return items.evaluateAll((links) => links.map((link) => link.getAttribute("title") ?? ""));
}

export const NO_PERMISSION = /You do not have permission to open this page/;

/** Everything the suite created, for cleanup. */
export class IamWorld {
  readonly teams: Team[] = [];
  readonly policies: Policy[] = [];
  readonly users: Persona[] = [];
  readonly coupons: string[] = [];

  private constructor(private readonly api: APIRequestContext) {}

  /** A world driven by its own super-admin API context (fixtures can't outlive `beforeAll`). */
  static async create(): Promise<IamWorld> {
    const api = await playwrightRequest.newContext({
      baseURL: baseURL(),
      storageState: "e2e/.auth/admin.json",
      extraHTTPHeaders: sessionFingerprint(),
    });
    const boss = await me(api);
    expect(boss.scopes, "the QA admin must be a super admin").toContain("*");
    return new IamWorld(api);
  }

  /** The super admin's API context, for checks the specs make as the super admin. */
  get superApi(): APIRequestContext {
    return this.api;
  }

  async template(code: string): Promise<Policy> {
    const page = await ok<{ items: Policy[] }>(
      await this.api.get("/api/v1/admin/iam/policies", { params: { search: code, limit: 50 } }),
    );
    const policy = page.items.find((item) => item.code === code);
    if (!policy) throw new Error(`Policy template ${code} is missing; run the IAM migrations`);
    return policy;
  }

  async policy(code: string, scopes: string[]): Promise<Policy> {
    const policy = await ok<Policy>(
      await this.api.post("/api/v1/admin/iam/policies", {
        data: { code: `e2e-${code}-${run}`, name: `e2e ${code} ${run}`, scopes },
      }),
    );
    this.policies.push(policy);
    return policy;
  }

  async team(code: string): Promise<Team> {
    const team = await ok<Team>(
      await this.api.post("/api/v1/admin/iam/groups", {
        data: { code: `e2e-${code}-${run}`, name: `e2e ${code} ${run}` },
      }),
    );
    this.teams.push(team);
    return team;
  }

  /** Provision an admin as the super admin (or as `as`, e.g. a team lead). */
  async user(
    name: string,
    options: {
      policies?: Policy[];
      teams?: Team[];
      leadOf?: Team[];
      resourceScope?: "all" | "team" | "own";
      boundary?: Policy;
      as?: APIRequestContext;
    } = {},
  ): Promise<Persona> {
    const email = `e2e+${name}-${run}@example.test`;
    const created = await ok<{ admin_user_id: string }>(
      await (options.as ?? this.api).post("/api/v1/admin/iam/users", {
        data: {
          email,
          full_name: `e2e ${name}`,
          password: PASSWORD,
          policy_ids: (options.policies ?? []).map((policy) => policy.policy_id),
          group_ids: (options.teams ?? []).map((team) => team.group_id),
          lead_of_group_ids: (options.leadOf ?? []).map((team) => team.group_id),
          resource_scope: options.resourceScope ?? "all",
          boundary_policy_id: options.boundary?.policy_id ?? null,
        },
      }),
    );
    const persona = { id: created.admin_user_id, email, name: `e2e ${name}` };
    this.users.push(persona);
    return persona;
  }

  async attachToTeam(team: Team, policy: Policy, resourceScope: "all" | "team" | "own" = "all") {
    await ok(
      await this.api.post(`/api/v1/admin/iam/groups/${team.group_id}/policies`, {
        data: { policy_id: policy.policy_id, resource_scope: resourceScope },
      }),
    );
  }

  /** Best effort: failures are ignored (rate limits retried), so a half-built world still cleans up. */
  async cleanup() {
    const api = this.api;
    for (const promotionId of this.coupons) {
      await patiently(() => api.delete(`/api/v1/admin/coupons/${promotionId}`));
    }
    for (const user of this.users) {
      await patiently(() => api.put(`/api/v1/admin/iam/users/${user.id}/boundary`, { data: { policy_id: null } }));
      await patiently(() => api.post(`/api/v1/admin/iam/users/${user.id}/revoke`));
    }
    for (const team of this.teams) {
      await patiently(() => api.put(`/api/v1/admin/iam/groups/${team.group_id}/boundary`, { data: { policy_id: null } }));
      await patiently(() => api.delete(`/api/v1/admin/iam/groups/${team.group_id}`));
    }
    for (const policy of this.policies) {
      await patiently(() => api.delete(`/api/v1/admin/iam/policies/${policy.policy_id}`));
    }
    await this.api.dispose();
  }
}

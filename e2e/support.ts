import { randomUUID } from "node:crypto";

import { expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";

/** QA credentials (dev only; the same values as `QA_*` in the backend `.env`). */
export function qa() {
  const key = process.env.QA_LOGIN_KEY;
  const admin = process.env.QA_ADMIN_EMAIL;
  const customer = process.env.QA_CUSTOMER_EMAIL;
  if (!key || !admin || !customer) {
    throw new Error("Set QA_LOGIN_KEY, QA_ADMIN_EMAIL and QA_CUSTOMER_EMAIL to run the e2e tests");
  }
  return { key, admin, customer };
}

/** Every API call sends a client fingerprint, as the admin app does. */
export const fingerprint = { "X-Client-Fingerprint": `e2e-${randomUUID()}` };

async function ok<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  expect(response.ok(), `${response.url()} → ${response.status()} ${await response.text()}`).toBeTruthy();
  return (await response.json()) as T;
}

/** The QA customer's `b2c:<uuid>` ref. */
export async function qaCustomerRef(api: APIRequestContext): Promise<string> {
  const page = await ok<{ items: { ref: string; email: string | null; source: string }[] }>(
    await api.get("/api/v1/admin/customers", { params: { query: qa().customer, limit: 5 }, headers: fingerprint }),
  );
  const row = page.items.find((item) => item.source === "b2c" && item.email?.toLowerCase() === qa().customer.toLowerCase());
  if (!row) throw new Error(`QA customer ${qa().customer} is not a B2C customer`);
  return row.ref;
}

export type SeededAccess = { customerRef: string; productId: string; title: string; orderId: string };

/** Gives the QA customer a published course they don't hold yet (an admin grant), for the tests to act on. */
export async function seedAccess(api: APIRequestContext): Promise<SeededAccess> {
  const customerRef = await qaCustomerRef(api);
  const options = await ok<{ product_id: string; title: string | null; slug: string; owned: boolean }[]>(
    await api.get(`/api/v1/admin/customers/${customerRef}/grant-options`, {
      params: { product_type: "course", limit: 50 },
      headers: fingerprint,
    }),
  );
  const option = options.find((item) => !item.owned && item.title);
  if (!option) throw new Error("No published course left to grant to the QA customer");
  const grants = await ok<{ order_id: string; product_id: string; status: string }[]>(
    await api.post(`/api/v1/admin/customers/${customerRef}/grants`, {
      data: { product_id: option.product_id, reason: "e2e: entitlement controls" },
      headers: fingerprint,
    }),
  );
  const grant = grants.find((item) => item.product_id === option.product_id && item.status === "active");
  if (!grant) throw new Error("The grant did not create active access");
  return { customerRef, productId: option.product_id, title: option.title ?? option.slug, orderId: grant.order_id };
}

/** Removes the seeded grant whatever state the test left it in. */
export async function cleanupAccess(api: APIRequestContext, seeded: SeededAccess | undefined): Promise<void> {
  if (!seeded) return;
  await api.delete(`/api/v1/admin/customers/${seeded.customerRef}/grants/${seeded.orderId}`, { headers: fingerprint });
}

export type SeededSubscription = { subscriptionId: string; customerId: string };

/**
 * Gives the QA customer a monthly subscription without paying: a subscription checkout, then the
 * backend's development-only activation (what Stripe's webhook does after payment). It has no Stripe
 * subscription, so lifecycle actions stay local.
 */
export async function seedSubscription(): Promise<SeededSubscription> {
  const apiUrl = process.env.E2E_API_URL ?? "http://localhost:8000";
  const customer = await playwrightRequest.newContext({ baseURL: apiUrl, extraHTTPHeaders: fingerprint });
  const login = await ok<{ tokens: { access_token: string } }>(
    await customer.post("/api/v1/auth/qa/login", { data: { email: qa().customer, key: qa().key } }),
  );
  const auth = { ...fingerprint, Authorization: `Bearer ${login.tokens.access_token}` };
  const plans = await ok<{ plan_id: string; plan_type: string; billing_interval: string }[]>(
    await customer.get("/api/v1/subscriptions/plans", { params: { audience_type: "individual" } }),
  );
  const plan = plans.find((item) => item.plan_type === "standard" && item.billing_interval === "month") ?? plans[0];
  if (!plan) throw new Error("No published individual subscription plan");
  const checkout = await ok<{ order_id: string }>(
    await customer.post("/api/v1/subscriptions/checkout", {
      data: { plan_id: plan.plan_id, success_url: "http://localhost:3000/", cancel_url: "http://localhost:3000/" },
      headers: { ...auth, "Idempotency-Key": randomUUID() },
    }),
  );
  const subscriptions = await ok<{ subscription_id: string; customer_id: string }[]>(
    await customer.post(`/api/v1/subscriptions/dev/activate-order/${checkout.order_id}`, { headers: auth }),
  );
  await customer.dispose();
  return { subscriptionId: subscriptions[0].subscription_id, customerId: subscriptions[0].customer_id };
}

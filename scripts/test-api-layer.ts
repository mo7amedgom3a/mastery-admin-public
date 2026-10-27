import {
  ApiError,
  getStudio,
  getStudioPreviewBase,
  listStudioAssets,
  listStudioVersions,
  saveStudioDraft,
  adminLogin,
  adminLogout,
  adminMe,
  adminRefresh,
  apiRequest,
  assignAdminRole,
  categoriesReport,
  createAdminUser,
  createBundle,
  createRole,
  customersReport,
  dashboardSales,
  dashboardSummary,
  getBundle,
  getConsultant,
  getConsultationInfo,
  getConsultationRevenue,
  getConsultationService,
  getB2cBooking,
  getB2cExpert,
  getB2cOverview,
  getB2cTop,
  listB2cBookings,
  listB2cExpertSlots,
  listB2cExperts,
  listB2cOrders,
  listSubscriptionPlans,
  getSubscriptionPlan,
  listPlanAbandonedCheckouts,
  getSubscriptionStatsOverview,
  getSubscriptionFunnel,
  listSubscribers,
  getSubscriber,
  getCustomer,
  getCustomer360,
  getDatabaseHealth,
  getFxRates,
  getHealth,
  getOffer,
  getOrder,
  getPackageCourses,
  getPackageSummary,
  getPaymentIntent,
  getProduct,
  getProductBehavior,
  getProductTransactions,
  getProductCertificates,
  getProductCurriculum,
  getProductInstructors,
  getProductLearners,
  getProductPrices,
  getProductRules,
  getPromotion,
  getCoupon,
  listCoupons,
  listCouponRedemptions,
  getReferralPartner,
  getRefundPreview,
  getSupportTicket,
  importCustomers,
  listAdminInstructors,
  listAdminUserRoles,
  getIamUser,
  setUserBoundary,
  listAdminUsers,
  listAnnouncements,
  listAuditLogs,
  listBanners,
  listCategories,
  listCertificateTemplates,
  listConsultants,
  listConsultationServices,
  listCountries,
  listCustomerSegments,
  listCustomers,
  listAdminEntitlements,
  listCustomerEntitlements,
  getAdminEntitlement,
  getProductPriceHistory,
  listPriceBatches,
  previewBulkPriceChange,
  listExtensionPackages,
  listImportIssues,
  listInstructorApplications,
  listModules,
  listNotificationEmails,
  listOffers,
  listOrders,
  listPaymentFailures,
  listPayments,
  listPriceLists,
  listProducts,
  listPromotions,
  listRatings,
  listReferralCommissions,
  listReferralPartners,
  listReferralPayouts,
  listReferralPolicies,
  listRefunds,
  listRoles,
  listSliders,
  listSocialLinks,
  listSupportTickets,
  listTags,
  paymentsReport,
  productSalesReport,
  promotionsReport,
  reconcilePaymentIntent,
  removeAdminRole,
  replySupportTicket,
  salesReport,
  setAdminUserStatus,
  setCustomerStatus,
  setProductStatus,
  setPromotionActive,
  setReferralPartnerStatus,
  setSupportTicketStatus,
  updateBundle,
  updateCustomer,
} from "../src/lib/api";

// --------------------------------------------------------------------------- harness

const args = new Set(process.argv.slice(2));
const includeMutations = args.has("--include-mutations");
const failOnSkip = args.has("--fail-on-skip");
const apiOrigin = process.env.API_BASE_URL ?? "http://localhost:8000";
const adminEmail = process.env.API_TEST_ADMIN_EMAIL ?? "admin@masteryacademy.site";
const adminPassword = process.env.API_TEST_ADMIN_PASSWORD ?? "Admin@12345";
/** Milliseconds to wait between requests; raise it if the backend rate-limits (default 120ms). */
const requestDelayMs = Number(process.env.API_TEST_DELAY_MS ?? 120);
/** How many times to retry a 429/503 before failing. */
const maxRetries = Number(process.env.API_TEST_MAX_RETRIES ?? 6);

type TestStatus = "pass" | "fail" | "skip";

type TestResult = {
  name: string;
  status: TestStatus;
  ms: number;
  detail?: string;
};

type LiveTest = {
  name: string;
  /** Requires `--include-mutations`. */
  mutates?: boolean;
  run: (ctx: TestContext) => Promise<void>;
};

type TestContext = {
  adminUserId?: string;
  roleId?: string;
  roleCode?: string;
  /** Refs (`b2c:<uuid>` / `legacy:<kind>:<id>`) of federated resources. */
  orderRef?: string;
  legacyOrderRef?: string;
  b2cOrderRef?: string;
  customerRef?: string;
  legacyCustomerRef?: string;
  paymentRef?: string;
  legacyProductRef?: string;
  legacyProductStatus?: string;
  packageRef?: string;
  b2cPackageRef?: string;
  productRef?: string;
  b2cProductId?: string;
  consultantId?: number;
  offerId?: number;
  promotionId?: number;
  promotionActive?: boolean;
  partnerId?: number;
  partnerStatus?: string;
  ticketId?: number;
  ticketStatus?: number;
  consultationId?: number;
  b2cExpertId?: string;
  b2cBookingId?: string;
  bundleId?: string;
  createdAdminId?: string;
  createdRoleId?: string;
};

class SkipTest extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkipTest";
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const LEGACY_WRITES_DISABLED = "Local legacy writes are disabled";

/** Back-office writes go to the legacy mirror; when the backend disables them (globally or per
 * resource) the test skips rather than failing. */
function isLegacyWritesDisabled(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  const message = String(error.message);
  return message.includes(LEGACY_WRITES_DISABLED) || message.includes("read-only");
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

async function runTest(name: string, run: () => Promise<void>): Promise<TestResult> {
  const started = performance.now();
  try {
    await run();
    return { name, status: "pass", ms: Math.round(performance.now() - started) };
  } catch (error) {
    if (error instanceof SkipTest) {
      return { name, status: "skip", ms: Math.round(performance.now() - started), detail: error.message };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return { name, status: "fail", ms: Math.round(performance.now() - started), detail };
  }
}

// --------------------------------------------------------------------------- cookie jar

type Fetch = typeof fetch;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function installCookieFetch(origin: string): { restore: () => void } {
  const originalFetch: Fetch = globalThis.fetch;
  const cookies = new Map<string, string>();

  const cookieHeader = () => [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; ");

  function storeSetCookies(response: Response): void {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(";")[0] ?? "";
      const index = pair.indexOf("=");
      if (index > 0) cookies.set(pair.slice(0, index).trim(), pair.slice(index + 1).trim());
    }
  }

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? new URL(input, origin).toString() : input;
    const headers = new Headers(init?.headers);
    const cookie = cookieHeader();
    if (cookie && !headers.has("Cookie")) headers.set("Cookie", cookie);

    let attempt = 0;
    for (;;) {
      if (requestDelayMs > 0) await sleep(requestDelayMs);
      const response = await originalFetch(url, { ...init, headers });
      storeSetCookies(response);

      if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(8_000, 500 * 2 ** attempt);
        await sleep(waitMs);
        attempt += 1;
        continue;
      }

      return response;
    }
  }) as Fetch;

  return { restore: () => { globalThis.fetch = originalFetch; } };
}

// --------------------------------------------------------------------------- offline

function clientBehaviorTests(): LiveTest[] {
  return [
    {
      name: "client builds same-origin URLs, query params, JSON body and request id",
      run: async () => {
        const originalFetch = globalThis.fetch;
        let capturedUrl = "";
        let capturedHeaders: Headers | undefined;
        let capturedBody = "";

        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
          capturedUrl = String(input);
          capturedHeaders = new Headers(init?.headers);
          capturedBody = String(init?.body);
          return jsonResponse({ ok: true });
        }) as Fetch;

        try {
          await apiRequest("POST", "/api/v1/health", {
            body: { ping: true },
            query: { a: [1, 2], b: true, empty: null },
          });
        } finally {
          globalThis.fetch = originalFetch;
        }

        assert(capturedUrl.startsWith("/api/v1/health?"), `expected /api/v1/health URL, got ${capturedUrl}`);
        assert(!capturedUrl.includes("/api/v1/api/v1"), "URL must not double-prefix /api/v1");
        assert(capturedUrl.includes("a=1") && capturedUrl.includes("a=2"), "array query params missing");
        assert(capturedUrl.includes("b=true"), "boolean query param missing");
        assert(!capturedUrl.includes("empty="), "null query params should be omitted");
        assert(capturedHeaders?.get("Content-Type") === "application/json", "Content-Type should be JSON");
        assert(typeof capturedHeaders?.get("X-Request-ID") === "string", "a request id header should be sent");
        assert(capturedBody === JSON.stringify({ ping: true }), "JSON body was not serialized");
      },
    },
    {
      name: "client interpolates path params and encodes them",
      run: async () => {
        const originalFetch = globalThis.fetch;
        let capturedUrl = "";

        globalThis.fetch = (async (input: RequestInfo | URL) => {
          capturedUrl = String(input);
          return jsonResponse({}, { status: 200 });
        }) as Fetch;

        try {
          await apiRequest("GET", "/api/v1/admin/orders/{order_id}", { path: { order_id: "a b/c" } });
        } finally {
          globalThis.fetch = originalFetch;
        }

        assert(capturedUrl === "/api/v1/admin/orders/a%20b%2Fc", `path not interpolated: ${capturedUrl}`);
      },
    },
    {
      name: "client rejects a missing path param",
      run: async () => {
        let threw = false;
        try {
          await apiRequest("GET", "/api/v1/admin/orders/{order_id}", { path: {} });
        } catch (error) {
          threw = true;
          assert(error instanceof Error && error.message.includes("order_id"), "expected missing-param error");
        }
        assert(threw, "expected apiRequest to throw on missing path param");
      },
    },
    {
      name: "client maps backend errors to ApiError with status and request id",
      run: async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () =>
          jsonResponse({ detail: "Not authenticated" }, { status: 401, headers: { "X-Request-ID": "req-401" } })) as Fetch;

        try {
          await apiRequest("GET", "/api/v1/admin/me");
          throw new Error("expected apiRequest to throw");
        } catch (error) {
          assert(error instanceof ApiError, "expected ApiError");
          assert(error.status === 401, "expected 401 status");
          assert(error.message === "Not authenticated", "expected backend detail message");
          assert(error.details.requestId === "req-401", "expected X-Request-ID metadata");
        } finally {
          globalThis.fetch = originalFetch;
        }
      },
    },
    {
      name: "client returns undefined for 204 and non-JSON responses",
      run: async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = (async () => new Response(null, { status: 204 })) as Fetch;
        try {
          const value = await apiRequest("POST", "/api/v1/admin/auth/logout", { body: {} });
          assert(value === undefined, "expected undefined for 204");
        } finally {
          globalThis.fetch = originalFetch;
        }
      },
    },
  ];
}

// --------------------------------------------------------------------------- date helper

function range(days: number): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

// --------------------------------------------------------------------------- live endpoints

function liveEndpointTests(): LiveTest[] {
  return [
    // -- session (needed first)
    { name: "POST /admin/auth/login (establish session)", run: async () => { await adminLogin({ email: adminEmail, password: adminPassword }); } },
    { name: "GET /admin/me", run: async () => { const me = await adminMe(); assert(me.email, "expected admin email"); } },

    // -- health (public)
    { name: "GET /health", run: async () => { await getHealth(); } },
    { name: "GET /health/database", run: async () => { await getDatabaseHealth(); } },

    // -- IAM
    {
      name: "GET /admin/admin-users",
      run: async (ctx) => {
        const page = await listAdminUsers({ limit: 5 });
        assert(Array.isArray(page.items), "expected items array");
        const superAdmin = page.items.find((u) => u.scopes.includes("*"));
        ctx.adminUserId = (superAdmin ?? page.items[0])?.admin_user_id;
      },
    },
    { name: "GET /admin/roles", run: async (ctx) => { const roles = await listRoles(); assert(Array.isArray(roles), "expected roles array"); ctx.roleId = roles[0]?.role_id; ctx.roleCode = roles[0]?.code; } },
    {
      name: "GET /admin/admin-users/{id}/roles",
      run: async (ctx) => {
        if (!ctx.adminUserId) throw new SkipTest("no admin user id available");
        await listAdminUserRoles(ctx.adminUserId);
      },
    },
    { name: "GET /admin/audit-logs", run: async () => { await listAuditLogs({ limit: 5 }); } },
    {
      name: "GET /admin/iam/users/{id} (permission boundary fields)",
      run: async (ctx) => {
        if (!ctx.adminUserId) throw new SkipTest("no admin user id available");
        const user = await getIamUser(ctx.adminUserId);
        assert(Array.isArray(user.granted_scopes), "expected granted_scopes array");
        assert(user.scopes.every((scope) => user.granted_scopes!.includes(scope)), "effective scopes must be a subset of granted scopes");
      },
    },

    // -- dashboard (B2C + legacy)
    { name: "GET /admin/dashboard/summary", run: async () => { const s = await dashboardSummary(); assert(typeof s.customers_total === "number", "expected numeric counters"); } },
    { name: "GET /admin/dashboard/sales", run: async () => { await dashboardSales({ ...range(30), report_currency: "AED" }); } },

    // -- sales reports (B2C + legacy; `source` filters) + FX
    {
      name: "GET /admin/reports/sales",
      run: async () => {
        const report = await salesReport({ ...range(30), report_currency: "USD" });
        assert(typeof report.totals.net === "number", "expected numeric net");
        assert(Array.isArray(report.days), "expected days array");
        const daysOrders = report.days.reduce((sum, day) => sum + day.orders, 0);
        assert(daysOrders === report.totals.orders, "daily orders must add up to the total");
        const bySource = (report.sources ?? []).reduce((sum, item) => sum + item.orders, 0);
        assert(bySource === report.totals.orders, "per-source orders must add up to the total");
      },
    },
    {
      name: "GET /admin/reports/sales?source=legacy",
      run: async () => {
        const report = await salesReport({ ...range(365), report_currency: "SAR", source: "legacy" });
        assert((report.sources ?? []).every((item) => item.source === "legacy"), "expected legacy sales only");
      },
    },
    { name: "GET /admin/reports/products", run: async () => { await productSalesReport({ ...range(30), report_currency: "SAR" }); } },
    { name: "GET /admin/reports/categories", run: async () => { await categoriesReport(range(30)); } },
    { name: "GET /admin/reports/promotions", run: async () => { await promotionsReport(range(30)); } },
    { name: "GET /admin/reports/customers", run: async () => { await customersReport({ ...range(30), limit: 10 }); } },
    { name: "GET /admin/reports/payments", run: async () => { await paymentsReport(range(30)); } },
    {
      name: "GET /admin/fx/rates",
      run: async () => {
        const rates = await getFxRates({ base: "USD", quotes: "AED,SAR" });
        assert(rates.length === 2 && rates.every((rate) => rate.rate > 0), "expected two positive rates");
      },
    },

    // -- orders (B2C + legacy)
    {
      name: "GET /admin/orders",
      run: async (ctx) => {
        const page = await listOrders({ limit: 5 });
        assert(page.items.every((item) => item.ref && item.source), "expected ref and source on every order");
        ctx.orderRef = page.items[0]?.ref;
      },
    },
    {
      name: "GET /admin/orders?source=b2c",
      run: async (ctx) => {
        const page = await listOrders({ source: "b2c", limit: 5 });
        assert(page.items.every((item) => item.source === "b2c"), "expected B2C orders only");
        ctx.b2cOrderRef = page.items[0]?.ref;
        ctx.paymentRef = page.items.find((item) => item.payment_ref)?.payment_ref ?? undefined;
      },
    },
    {
      name: "GET /admin/orders?source=legacy&status=paid",
      run: async (ctx) => {
        const page = await listOrders({ source: "legacy", status: "paid", limit: 5 });
        assert(page.items.every((item) => item.source === "legacy" && item.status === "paid"), "expected paid legacy orders");
        ctx.legacyOrderRef = page.items[0]?.ref;
        ctx.legacyCustomerRef = page.items[0]?.customer_ref ?? undefined;
      },
    },
    { name: "GET /admin/orders/{ref} (b2c)", run: async (ctx) => { if (!ctx.b2cOrderRef) throw new SkipTest("no B2C order"); await getOrder(ctx.b2cOrderRef); } },
    {
      name: "GET /admin/orders/{ref} (legacy)",
      run: async (ctx) => {
        if (!ctx.legacyOrderRef) throw new SkipTest("no legacy order");
        const order = await getOrder(ctx.legacyOrderRef);
        assert(order.source === "legacy", "expected a legacy order");
      },
    },

    // -- payments (B2C intents + legacy gateway orders)
    { name: "GET /admin/payments", run: async () => { await listPayments({ limit: 5 }); } },
    { name: "GET /admin/payments?source=legacy", run: async () => { await listPayments({ source: "legacy", status: "succeeded", limit: 5 }); } },
    { name: "GET /admin/payments/failures", run: async () => { await listPaymentFailures({ limit: 5 }); } },
    { name: "GET /admin/payments/refunds", run: async () => { await listRefunds({ limit: 5 }); } },
    { name: "GET /admin/payments/orders/{ref}/refund-preview", run: async (ctx) => { if (!ctx.b2cOrderRef) throw new SkipTest("no B2C order"); await getRefundPreview(ctx.b2cOrderRef); } },
    { name: "GET /admin/payments/{ref} (b2c)", run: async (ctx) => { if (!ctx.paymentRef) throw new SkipTest("no B2C payment"); await getPaymentIntent(ctx.paymentRef); } },
    { name: "GET /admin/payments/{ref} (legacy)", run: async (ctx) => { if (!ctx.legacyOrderRef) throw new SkipTest("no legacy order"); await getPaymentIntent(ctx.legacyOrderRef); } },

    // -- customers (B2C + legacy accounts not imported yet)
    {
      name: "GET /admin/customers",
      run: async (ctx) => {
        const page = await listCustomers({ limit: 5 });
        ctx.customerRef = page.items.find((item) => item.source === "b2c")?.ref;
      },
    },
    { name: "GET /admin/customers?source=legacy", run: async () => { await listCustomers({ source: "legacy", limit: 5 }); } },
    { name: "GET /admin/customers/{ref}", run: async (ctx) => { if (!ctx.customerRef) throw new SkipTest("no customer"); await getCustomer(ctx.customerRef); } },
    { name: "GET /admin/customers/{ref}/360", run: async (ctx) => { if (!ctx.customerRef) throw new SkipTest("no customer"); await getCustomer360(ctx.customerRef); } },
    {
      name: "GET /admin/customers/{ref}/360 (buyer of a legacy order)",
      run: async (ctx) => {
        if (!ctx.legacyCustomerRef) throw new SkipTest("no legacy buyer");
        const snapshot = await getCustomer360(ctx.legacyCustomerRef);
        assert((snapshot.legacy_orders_count ?? 0) > 0, "expected legacy orders");
      },
    },
    { name: "GET /admin/customers/import/issues", run: async () => { await listImportIssues({ limit: 5 }); } },
    { name: "GET /admin/customers/segments", run: async () => { await listCustomerSegments({ limit: 5 }); } },

    // -- catalog (B2C products + legacy courses/packages not migrated yet)
    {
      name: "GET /admin/catalog/products",
      run: async (ctx) => {
        const page = await listProducts({ product_type: "course", source: "b2c", limit: 5 });
        ctx.productRef = page.items[0]?.ref ?? undefined;
        ctx.b2cProductId = page.items[0]?.product_id ?? undefined;
      },
    },
    {
      name: "GET /admin/catalog/products?source=legacy",
      run: async (ctx) => {
        const courses = await listProducts({ source: "legacy", product_type: "course", limit: 5 });
        ctx.legacyProductRef = courses.items[0]?.ref ?? undefined;
        ctx.legacyProductStatus = courses.items[0]?.status;
        const packages = await listProducts({ source: "legacy", product_type: "package", limit: 5 });
        ctx.packageRef = packages.items[0]?.ref ?? undefined;
        const b2cPackages = await listProducts({ source: "b2c", product_type: "package", limit: 5 });
        ctx.b2cPackageRef = b2cPackages.items[0]?.ref ?? undefined;
      },
    },
    { name: "GET /admin/catalog/products/{ref} (b2c)", run: async (ctx) => { if (!ctx.productRef) throw new SkipTest("no product"); await getProduct(ctx.productRef); } },
    { name: "GET /admin/catalog/products/{ref} (legacy)", run: async (ctx) => { if (!ctx.legacyProductRef) throw new SkipTest("no legacy product"); await getProduct(ctx.legacyProductRef); } },
    {
      name: "GET /admin/catalog/products/{ref}/* (legacy content)",
      run: async (ctx) => {
        const ref = ctx.legacyProductRef;
        if (!ref) throw new SkipTest("no legacy product");
        await getProductCurriculum(ref);
        await getProductPrices(ref);
        await getProductRules(ref);
        await getProductCertificates(ref);
        await getProductInstructors(ref);
        await getProductLearners(ref, 5);
      },
    },
    {
      name: "GET /admin/catalog/products/{ref}/behavior",
      run: async (ctx) => {
        if (!ctx.productRef) throw new SkipTest("no product");
        const stats = await getProductBehavior(ctx.productRef, { bucket: "month" });
        assert(Array.isArray(stats.points), "expected behaviour points");
        assert(typeof stats.views === "number", "expected numeric views");
        assert(typeof stats.unique_viewers === "number", "expected numeric unique viewers");
      },
    },
    {
      name: "GET /admin/catalog/products/{ref}/transactions",
      run: async (ctx) => {
        if (!ctx.productRef) throw new SkipTest("no product");
        const page = await getProductTransactions(ctx.productRef, { bucket: "month", limit: 5 });
        assert(Array.isArray(page.items), "expected transaction rows");
        assert(Array.isArray(page.points), "expected transaction points");
        assert(typeof page.total === "number", "expected a total count");
        for (const row of page.items) {
          assert(row.payment_intent_id, "a transaction must name its payment intent");
          assert(row.order_id, "a transaction must name its order");
        }
      },
    },
    {
      name: "GET /admin/catalog/products/{ref}/summary|courses (package)",
      run: async (ctx) => {
        if (!ctx.b2cPackageRef) throw new SkipTest("no B2C package");
        await getPackageSummary(ctx.b2cPackageRef);
        await getPackageCourses(ctx.b2cPackageRef);
      },
    },
    // -- course studio (page drafts, versions, assets, preview data)
    {
      name: "GET /admin/catalog/products/{ref}/studio (legacy)",
      run: async (ctx) => {
        if (!ctx.legacyProductRef) throw new SkipTest("no legacy product");
        const page = await getStudio(ctx.legacyProductRef);
        assert(page.draft.schema_version === 1, "expected a v1 page document");
        assert(page.draft_revision > 0 || page.seeded, "an unsaved page must be seeded");
        await listStudioVersions(ctx.legacyProductRef);
        await listStudioAssets(ctx.legacyProductRef, { limit: 5 });
      },
    },
    { name: "GET /admin/catalog/products/{ref}/studio (b2c)", run: async (ctx) => { if (!ctx.productRef) throw new SkipTest("no product"); await getStudio(ctx.productRef); } },
    {
      name: "GET /admin/catalog/products/{ref}/studio/preview-base",
      run: async (ctx) => {
        if (!ctx.legacyProductRef) throw new SkipTest("no legacy product");
        const payload = await getStudioPreviewBase(ctx.legacyProductRef);
        assert(payload.kind, "expected a product kind");
        if (payload.kind === "course" || payload.kind === "diploma") {
          const base = payload.base as { course?: { id?: number } } | null;
          assert(base?.course?.id && base.course.id > 0, "expected the legacy course in the base payload");
        }
      },
    },
    { name: "GET /admin/catalog/categories", run: async () => { await listCategories({ limit: 5 }); } },
    { name: "GET /admin/catalog/price-lists", run: async () => { await listPriceLists({ limit: 5 }); } },
    { name: "GET /admin/catalog/extension-packages", run: async () => { await listExtensionPackages({ limit: 5 }); } },

    // -- customer access and pricing (read-only; previews write nothing)
    {
      name: "GET /admin/entitlements[/{id}]",
      run: async () => {
        const page = await listAdminEntitlements({ limit: 5, expiring_within_days: 365 });
        const first = page.items[0] ?? (await listAdminEntitlements({ limit: 1 })).items[0];
        if (!first) throw new SkipTest("no entitlements");
        const detail = await getAdminEntitlement(first.entitlement_id);
        assert(Array.isArray(detail.extensions) && Array.isArray(detail.events), "expected extensions and events");
      },
    },
    {
      name: "GET /admin/customers/{ref}/entitlements",
      run: async (ctx) => {
        if (!ctx.customerRef) throw new SkipTest("no customer");
        await listCustomerEntitlements(ctx.customerRef, { limit: 5 });
      },
    },
    {
      name: "GET /admin/pricing/products/{id}/history + POST /admin/pricing/bulk/preview",
      run: async (ctx) => {
        if (!ctx.b2cProductId) throw new SkipTest("no B2C product");
        await getProductPriceHistory(ctx.b2cProductId);
        const preview = await previewBulkPriceChange({
          selector: { product_ids: [ctx.b2cProductId] },
          operation: { field: "amount", type: "percent", value: 10, rounding: "x99" },
          currency_code: "USD",
        });
        assert(preview.total <= 1, "expected at most the one selected product");
      },
    },
    { name: "GET /admin/pricing/batches", run: async () => { await listPriceBatches({ limit: 5 }); } },
    { name: "GET /admin/catalog/certificates", run: async () => { await listCertificateTemplates({ limit: 5 }); } },
    { name: "GET /admin/catalog/ratings", run: async () => { await listRatings({ limit: 5 }); } },

    // -- bundles
    { name: "GET /admin/bundles/{product_id}", run: async (ctx) => { if (!ctx.bundleId) throw new SkipTest("no bundle created in this run"); await getBundle(ctx.bundleId); } },

    // -- instructors and consultations
    { name: "GET /admin/instructors", run: async () => { await listAdminInstructors({ limit: 5 }); } },
    { name: "GET /admin/instructors/applications", run: async () => { await listInstructorApplications({ limit: 5 }); } },
    {
      name: "GET /admin/consultations/services",
      run: async (ctx) => {
        const page = await listConsultationServices({ limit: 5 });
        ctx.consultationId = page.items[0]?.legacy_consultancy_id;
      },
    },
    {
      name: "GET /admin/consultations/services/{id}[/info|/revenue]",
      run: async (ctx) => {
        if (!ctx.consultationId) throw new SkipTest("no consultation service");
        await getConsultationService(ctx.consultationId);
        await getConsultationInfo(ctx.consultationId);
        await getConsultationRevenue(ctx.consultationId);
      },
    },
    {
      name: "GET /admin/consultations/consultants[/{id}]",
      run: async (ctx) => {
        const page = await listConsultants({ limit: 5 });
        ctx.consultantId = page.items[0]?.legacy_consultant_id;
        if (ctx.consultantId) await getConsultant(ctx.consultantId);
      },
    },

    // -- B2C consultations management
    {
      name: "GET /admin/consultations-b2c/overview|top",
      run: async () => {
        const end = new Date().toISOString();
        const start = new Date(Date.now() - 30 * 86_400_000).toISOString();
        await getB2cOverview({ start, end });
        await getB2cTop({ start, end, by: "services" });
        await getB2cTop({ start, end, by: "experts" });
      },
    },
    {
      name: "GET /admin/consultations-b2c/experts[/{id}[/slots]]",
      run: async (ctx) => {
        const page = await listB2cExperts({ limit: 5 });
        ctx.b2cExpertId = page.items[0]?.consultant_id;
        if (!ctx.b2cExpertId) throw new SkipTest("no expert");
        await getB2cExpert(ctx.b2cExpertId);
        await listB2cExpertSlots(ctx.b2cExpertId);
      },
    },
    {
      name: "GET /admin/consultations-b2c/bookings[/{id}]",
      run: async (ctx) => {
        const page = await listB2cBookings({ limit: 5 });
        ctx.b2cBookingId = page.items[0]?.booking_id;
        if (!ctx.b2cBookingId) throw new SkipTest("no booking");
        await getB2cBooking(ctx.b2cBookingId);
      },
    },
    { name: "GET /admin/consultations-b2c/orders", run: async () => { await listB2cOrders({ limit: 5 }); } },

    // -- B2C subscriptions management
    {
      name: "GET /admin/subscriptions/plans[/{id}[/abandoned-checkouts]]",
      run: async () => {
        const plans = await listSubscriptionPlans({ lang: "en" });
        const planId = plans[0]?.plan_id;
        if (!planId) throw new SkipTest("no subscription plan");
        await getSubscriptionPlan(planId, "en");
        await listPlanAbandonedCheckouts(planId, { limit: 5 });
      },
    },
    {
      name: "GET /admin/subscriptions/stats/overview|funnel",
      run: async () => {
        const end = new Date().toISOString().slice(0, 10);
        const start = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
        await getSubscriptionStatsOverview({ start, end });
        await getSubscriptionFunnel({ start, end });
      },
    },
    {
      name: "GET /admin/subscriptions/customer-subscriptions[/{id}]",
      run: async () => {
        const page = await listSubscribers({ limit: 5 });
        const id = page.items[0]?.subscription_id;
        if (!id) throw new SkipTest("no subscriber");
        await getSubscriber(id);
      },
    },

    // -- promotions
    {
      name: "GET /admin/promotions",
      run: async (ctx) => {
        const page = await listPromotions({ limit: 5 });
        ctx.promotionId = page.items[0]?.legacy_coupon_id;
        ctx.promotionActive = page.items[0]?.active;
      },
    },
    { name: "GET /admin/promotions/{id}", run: async (ctx) => { if (!ctx.promotionId) throw new SkipTest("no promotion"); await getPromotion(ctx.promotionId); } },
    {
      name: "GET /admin/promotions/offers[/{id}]",
      run: async (ctx) => {
        const page = await listOffers({ limit: 5 });
        ctx.offerId = page.items[0]?.legacy_offer_id;
        if (ctx.offerId) await getOffer(ctx.offerId);
      },
    },

    // -- native coupons (read-only: no writes against shared data)
    {
      name: "GET /admin/coupons[/{id}[/redemptions]]",
      run: async () => {
        const page = await listCoupons({ limit: 5 });
        const first = page.items[0];
        if (!first) throw new SkipTest("no coupon");
        await getCoupon(first.promotion_id);
        await listCouponRedemptions(first.promotion_id, { limit: 5 });
      },
    },

    // -- referrals
    {
      name: "GET /admin/referrals/partners",
      run: async (ctx) => {
        const page = await listReferralPartners({ limit: 5 });
        ctx.partnerId = page.items[0]?.legacy_affiliate_id;
        ctx.partnerStatus = page.items[0]?.status;
      },
    },
    { name: "GET /admin/referrals/partners/{id}", run: async (ctx) => { if (!ctx.partnerId) throw new SkipTest("no partner"); await getReferralPartner(ctx.partnerId); } },
    { name: "GET /admin/referrals/payouts", run: async () => { await listReferralPayouts({ limit: 5 }); } },
    { name: "GET /admin/referrals/commissions", run: async () => { await listReferralCommissions({ limit: 5 }); } },
    { name: "GET /admin/referrals/policies", run: async () => { await listReferralPolicies(); } },

    // -- support
    {
      name: "GET /admin/support/tickets",
      run: async (ctx) => {
        const page = await listSupportTickets({ limit: 5 });
        ctx.ticketId = page.items[0]?.legacy_ticket_id;
        ctx.ticketStatus = page.items[0]?.status ?? undefined;
      },
    },
    { name: "GET /admin/support/tickets/{id}", run: async (ctx) => { if (!ctx.ticketId) throw new SkipTest("no ticket"); await getSupportTicket(ctx.ticketId); } },

    // -- marketing content and settings
    { name: "GET /admin/marketing/announcements", run: async () => { await listAnnouncements({ limit: 5 }); } },
    { name: "GET /admin/marketing/banners", run: async () => { await listBanners({ limit: 5 }); } },
    { name: "GET /admin/marketing/sliders", run: async () => { await listSliders({ limit: 5 }); } },
    { name: "GET /admin/settings/social-links", run: async () => { await listSocialLinks(); } },
    { name: "GET /admin/settings/notification-emails", run: async () => { await listNotificationEmails(); } },
    { name: "GET /admin/settings/tracking-tags", run: async () => { await listTags({ limit: 5 }); } },
    { name: "GET /admin/settings/permission-modules", run: async () => { await listModules(); } },
    { name: "GET /admin/settings/countries", run: async () => { await listCountries(); } },

    // ----------------------------------------------------------------- mutations
    { name: "POST /admin/auth/refresh", mutates: true, run: async () => { await adminRefresh({}); } },
    {
      // Clearing a boundary that isn't set is a no-op; it only proves the route and its guard.
      name: "PUT /admin/iam/users/{id}/boundary (clear, no-op)",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.adminUserId) throw new SkipTest("no admin user id available");
        if ((await getIamUser(ctx.adminUserId)).boundary_policy_id) throw new SkipTest("admin has a boundary; not clearing it");
        const user = await setUserBoundary(ctx.adminUserId, null);
        assert(user.boundary_policy_id == null, "expected no boundary");
      },
    },

    {
      name: "POST /admin/admin-users + PATCH status (create then suspend)",
      mutates: true,
      run: async (ctx) => {
        const email = `api-layer-${Date.now()}@example.com`;
        const created = await createAdminUser({ email, password: "ApiLayerTest123!", full_name: "API Layer Test" });
        ctx.createdAdminId = created.admin_user_id;
        const suspended = await setAdminUserStatus(created.admin_user_id, { status: "suspended" });
        assert(suspended.status === "suspended", "expected admin to be suspended");
      },
    },
    {
      name: "POST /admin/roles + assign/remove role",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.adminUserId) throw new SkipTest("no admin user to assign a role to");
        const role = await createRole({ code: `api_layer_${Date.now()}`, name: "API Layer Test", scopes: [] });
        ctx.createdRoleId = role.role_id;
        const roles = await assignAdminRole(ctx.adminUserId, { role_id: role.role_id });
        assert(roles.some((r) => r.role_id === role.role_id), "role not assigned");
        await removeAdminRole(ctx.adminUserId, role.role_id);
      },
    },
    {
      name: "POST /admin/customers/import (dry run)",
      mutates: true,
      run: async () => {
        await importCustomers({ batch_size: 50, dry_run: true, restart: false });
      },
    },
    {
      name: "PUT /admin/catalog/products/{ref}/studio/draft (resave + stale 409)",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.legacyProductRef) throw new SkipTest("no legacy product");
        // Saves the current (or seeded) draft unchanged; nothing is published.
        const page = await getStudio(ctx.legacyProductRef);
        const saved = await saveStudioDraft(ctx.legacyProductRef, { document: page.draft, base_revision: page.draft_revision });
        assert(saved.draft_revision === page.draft_revision + 1, "expected the revision to advance");
        try {
          await saveStudioDraft(ctx.legacyProductRef, { document: page.draft, base_revision: page.draft_revision });
        } catch (error) {
          assert(error instanceof ApiError && error.status === 409, `expected 409, got ${String(error)}`);
          return;
        }
        throw new Error("a stale save must be rejected with 409");
      },
    },
    {
      name: "POST /admin/catalog/products/{legacy ref}/status (no-op toggle)",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.legacyProductRef) throw new SkipTest("no legacy product");
        try {
          await setProductStatus(ctx.legacyProductRef, ctx.legacyProductStatus === "published" ? "published" : "draft");
        } catch (error) {
          if (isLegacyWritesDisabled(error)) throw new SkipTest("backend has legacy writes disabled");
          throw error;
        }
      },
    },
    {
      name: "POST /admin/promotions/{id}/active (no-op toggle)",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.promotionId) throw new SkipTest("no promotion");
        try {
          await setPromotionActive(ctx.promotionId, { active: ctx.promotionActive ?? true });
        } catch (error) {
          if (isLegacyWritesDisabled(error)) throw new SkipTest("backend has legacy writes disabled");
          throw error;
        }
      },
    },
    {
      name: "POST /admin/referrals/partners/{id}/status (no-op toggle)",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.partnerId || (ctx.partnerStatus !== "approved" && ctx.partnerStatus !== "pending")) {
          throw new SkipTest("no partner with a settable status");
        }
        try {
          await setReferralPartnerStatus(ctx.partnerId, { status: ctx.partnerStatus });
        } catch (error) {
          if (isLegacyWritesDisabled(error)) throw new SkipTest("backend has legacy writes disabled");
          throw error;
        }
      },
    },
    {
      name: "POST /admin/support/tickets/{id}/status (no-op toggle)",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.ticketId || ctx.ticketStatus === undefined) throw new SkipTest("no ticket");
        try {
          await setSupportTicketStatus(ctx.ticketId, { status: ctx.ticketStatus });
        } catch (error) {
          if (isLegacyWritesDisabled(error)) throw new SkipTest("backend has legacy writes disabled");
          throw error;
        }
      },
    },
    {
      name: "POST /admin/support/tickets/{id}/replies",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.ticketId) throw new SkipTest("no ticket");
        try {
          await replySupportTicket(ctx.ticketId, { message: `API layer smoke test ${new Date().toISOString()}` });
        } catch (error) {
          if (isLegacyWritesDisabled(error)) throw new SkipTest("backend has legacy writes disabled");
          throw error;
        }
      },
    },
    {
      name: "POST /admin/customers/{ref}/status (no-op, keeps current status)",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.customerRef) throw new SkipTest("no customer");
        const detail = await getCustomer(ctx.customerRef);
        await setCustomerStatus(ctx.customerRef, { status: detail.status });
      },
    },
    {
      name: "PATCH /admin/customers/{ref} (no-op, re-sends current name)",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.customerRef) throw new SkipTest("no customer");
        const detail = await getCustomer(ctx.customerRef);
        await updateCustomer(ctx.customerRef, { full_name: detail.full_name ?? undefined });
      },
    },
    {
      name: "POST /admin/bundles + PUT /admin/bundles/{id}",
      mutates: true,
      run: async (ctx) => {
        const productId = ctx.b2cProductId;
        if (!productId) throw new SkipTest("no B2C product to build a bundle from");
        const slug = `api-layer-bundle-${Date.now()}`;
        const created = await createBundle({
          slug,
          title: "API Layer Test Bundle",
          status: "draft",
          currency_code: "USD",
          amount: "100.00",
          cpd_eligible: false,
          members: [{ product_id: productId, sort_order: 1, quantity: 1 }],
        });
        ctx.bundleId = created.product_id;
        await updateBundle(created.product_id, {
          slug,
          title: "API Layer Test Bundle (updated)",
          status: "draft",
          currency_code: "USD",
          amount: "120.00",
          cpd_eligible: false,
          members: [{ product_id: productId, sort_order: 1, quantity: 1 }],
        });
      },
    },
    {
      name: "POST /admin/payments/{ref}/reconcile",
      mutates: true,
      run: async (ctx) => {
        if (!ctx.paymentRef) throw new SkipTest("no B2C payment");
        await reconcilePaymentIntent(ctx.paymentRef);
      },
    },
    { name: "POST /admin/auth/logout (ends session)", mutates: true, run: async () => { await adminLogout({}); } },
  ];
}

// --------------------------------------------------------------------------- runner

async function main() {
  console.log(`API base URL:   ${apiOrigin}`);
  console.log(`Admin login:    ${adminEmail}`);
  console.log(`Mutations:      ${includeMutations ? "ENABLED" : "skipped (pass --include-mutations)"}`);
  console.log("");

  const results: TestResult[] = [];
  const ctx: TestContext = {};

  for (const test of clientBehaviorTests()) {
    results.push(await runTest(test.name, () => test.run(ctx)));
  }

  const { restore } = installCookieFetch(apiOrigin);
  try {
    for (const test of liveEndpointTests()) {
      if (test.mutates && !includeMutations) {
        results.push({ name: test.name, status: "skip", ms: 0, detail: "Run with --include-mutations" });
        continue;
      }
      results.push(await runTest(test.name, () => test.run(ctx)));
    }
  } finally {
    restore();
  }

  printSummary(results);

  const failed = results.some((r) => r.status === "fail");
  const skipped = results.some((r) => r.status === "skip");
  if (failed || (failOnSkip && skipped)) process.exitCode = 1;
}

function printSummary(results: TestResult[]): void {
  const width = Math.max(...results.map((r) => r.name.length), 12);
  for (const result of results) {
    const mark = result.status === "pass" ? "PASS" : result.status === "skip" ? "SKIP" : "FAIL";
    const detail = result.detail ? `  — ${result.detail}` : "";
    console.log(`${mark}  ${result.name.padEnd(width)}  ${String(result.ms).padStart(5)}ms${detail}`);
  }

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  console.log("");
  console.log(`${passed} passed, ${failed} failed, ${skipped} skipped (${results.length} total)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

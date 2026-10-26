# How the admin dashboard talks to the backend

The dashboard has **one backend API: the admin module (`/api/v1/admin/*`)**. It covers B2C and the legacy platform alike. There is no legacy-admin API to call and no legacy client in `src/lib/api/`. The backend side of this contract, and the reasons for it, are in `newwebsitebackend/app/modules/admin/ADMIN_API.md`.

## 1. Why one API

The dashboard used to call two APIs:
- `/admin/*` and `/admin/backoffice/*` for B2C-shaped data;
- `/legacy-admin/*` for raw legacy tables, read through `legacyGet` and a generic resource browser.

Pages had to know which copy of a resource to read, how to stitch the copies together, and legacy column names such as `courseId` and `isMainPrice`. Old orders and sales were invisible to the B2C screens.

Now the backend's admin module is **the source of truth for admin management**:

```
dashboard page ─▶ src/lib/api/<area>.ts ─▶ /api/v1/admin/* ─▶ admin module ─┬─▶ B2C modules
                                                                            └─▶ legacy module (internal)
```

- **One resource, one endpoint.** Orders, payments, customers, products, reports and the rest each have a single API. The backend merges B2C and legacy data behind it.
- **High-level shapes.** Responses are typed back-office models (snake_case, refs, enums), never legacy table rows.
- **The source is data, not a code path.** Every merged item says where it comes from (`source: "b2c" | "legacy"`). The UI shows it with a badge and filters on it; it doesn't branch to a different API.
- **No duplicates.** An imported legacy customer or a migrated course appears once, as its B2C record.

## 2. The request path

| Step | Where | What happens |
| --- | --- | --- |
| 1 | page / component | `useQuery(ordersQueries.list(params))` (or a service function in a mutation) |
| 2 | `src/lib/api/sales/orders.ts` | `listOrders(params)` → `apiGet("admin/orders", { query })` |
| 3 | `src/lib/api/client.ts` | Builds `/api/v1/admin/orders?...` (same origin), fills `{param}` path placeholders with URL-encoding, adds `X-Request-ID`, sends cookies (`credentials: "same-origin"`). On a 401 it calls `admin/auth/refresh` once and retries. Errors become `ApiError` with status, `detail` and request id. |
| 4 | Vite dev proxy (`vite.config.ts`) / reverse proxy in production | `/api/*` → backend (`http://localhost:8000` in dev), so the backend's httpOnly cookies are first-party: no tokens in JS, no CORS. |
| 5 | backend admin module | Checks the admin's scopes, reads or writes B2C and/or legacy data, returns a typed model. |

**Auth.** `POST /admin/auth/login` sets the `b2c_admin_access_token` and `b2c_admin_refresh_token` cookies. The session store (`src/lib/auth/store.ts`) loads `/admin/me` for the admin's scopes. Permission checks in the UI (`src/lib/permissions.ts`) only hide things; the API enforces every scope.

## 3. Types come from the backend

```bash
# 1. In newwebsitebackend: export the spec after a backend change
uv run python -c "import json; from app.main import create_app; print(json.dumps(create_app().openapi(), ensure_ascii=False, indent=2))" > ../admin-dashboard/openapi.json

# 2. Here: regenerate the TypeScript types
npm run api:types          # openapi.json → src/types/openapi.ts
npx tsc -b                 # a breaking API change shows up as a type error
```

Service modules name each backend operation by its `operationId` and derive every type from it, using `src/lib/api/operation-types.ts`:

```ts
type ListOrdersOp = "search_orders_api_v1_admin_orders_get";
export type AdminOrder = SuccessResponse<ListOrdersOp>["items"][number];
export type AdminOrdersParams = QueryParams<ListOrdersOp>;
```

`src/lib/api/contract.ts` only holds aliases of generated schemas plus small UI helpers (`Page`, `Row`, `RecordSource`). Don't hand-write response shapes.

## 4. Refs, sources and read-only legacy data

**Refs.** Federated resources are addressed by an opaque `ref`, and routes take the ref:

| Ref | Route |
| --- | --- |
| `b2c:<uuid>` (a bare UUID also works) | B2C product, order, payment or customer |
| `legacy:course:<id>`, `legacy:package:<id>` | `/learning/catalog/:ref` |
| `legacy:order:<id>` (also a legacy payment) | `/sales/orders/:ref`, `/sales/payments/:ref` |
| `legacy:user:<id>` | `/customers/:ref` |

Build links with `src/lib/refs.ts` (`orderHref`, `paymentHref`, `customerHref`, `productHref`, `shortRef`, `refParam`). Read the route param with `refParam(useParams().id)`, which decodes it. Never build links from `order_id` or `customer_id`: they are null on legacy items.

**Source.**
- Show it with `<SourceBadge source={item.source} />` (`components/ui/source-badge.tsx`).
- Lists accept `source: "all" | "b2c" | "legacy"`; pages expose it as a filter.
- Reports take the global "Sales source" picker (`useReportCurrency().source`) next to the currency picker.

**Read-only legacy data.** These actions are B2C-only; the API answers 422 for a legacy ref:
- cancel an order;
- refund preview;
- reconcile a payment;
- edit a customer or change their status.

Use `isLegacy(item)` from `src/lib/refs.ts` to disable or hide them.

**Legacy writes.** These change the local legacy mirror only, and a 403 means local writes are disabled on the backend:
- product status of a legacy-only product, and creating a course;
- promotions;
- referral partner and payout status;
- ticket status and replies.

**Packages.** Packages are **B2C-owned** (`b2c.products` with `product_type = "package"` + member rows in
`b2c.package_items`); the legacy `MAS_CUR_Courses` mirror was only read by the one-off backfill
(`migrations/20261017_package_items_backfill.sql`). `/admin/catalog/products/{ref}/{summary,courses}` and
`/admin/catalog/products/{ref}/package*` read and write B2C. A legacy-only package (no B2C product) stays
read-only and falls back to the legacy content tabs.

**Products.** `/learning/catalog/:ref` serves every product. `GET /admin/catalog/products/{ref}` returns:
- `product` (the list item);
- `b2c` (B2C detail, if there is a B2C product);
- `legacy` (legacy detail, if a legacy course or package is linked);
- `links` (both ids).

The legacy content tabs (`features/learning/components/legacy-product-content.tsx`) call `/admin/catalog/products/{ref}/{curriculum,prices,rules,certificates,ratings,instructors,learners,summary,courses}`, which accept either ref.

The product's analytics panels read `/admin/catalog/products/{ref}/{sales,behavior,transactions}`: sales/students, page views + wishlist/cart events, and B2C payment transactions (each with a per-bucket series).

## 5. API modules

| Module (`src/lib/api/`) | Backend | Notes |
| --- | --- | --- |
| `auth/admin-auth.ts`, `iam/rbac.ts` | `/admin/auth/*`, `/admin/me`, `/admin/admin-users`, `/admin/roles`, `/admin/audit-logs` | Identity and access |
| `dashboard/dashboard.ts` | `/admin/dashboard/{summary,sales}` | KPIs over both systems |
| `analytics/reports.ts` | `/admin/reports/*?source=` | Rows carry `ref` and `sources`; `SalesReport.sources` splits totals |
| `sales/orders.ts`, `sales/payments.ts` | `/admin/orders`, `/admin/payments` | Merged; refs in paths |
| `customers/customers.ts` | `/admin/customers` (+ `/{ref}/360`, `/import`, `/segments`) | B2C customers and legacy accounts not imported yet |
| `customers/tickets.ts` | `/admin/support/tickets` | |
| `learning/catalog.ts` | `/admin/catalog/*` | Products by ref, legacy content, categories, price lists, extension packages, certificates, ratings, and the per-product analytics sub-resources (`sales`, `behavior`, `transactions`) |
| `learning/instructors.ts` | `/admin/instructors` (+ public `/legacy/instructors/*` for profiles) | |
| `learning/consultations.ts`, `learning/consultants.ts` | `/admin/consultations/*` | |
| `marketing/promotions.ts`, `marketing/referrals.ts`, `marketing/content.ts` | `/admin/promotions`, `/admin/referrals`, `/admin/marketing` | |
| `subscriptions/admin.ts` | `/admin/subscriptions/*` | Plans (products = what a plan grants, features, benefits, discount), stats, team leads, and customer subscriptions: list, detail and the lifecycle actions `cancel` (`{immediate, reason?}`), `resume`, `extend` (`{days, reason}`), `revoke` (`{reason}`). Lifecycle calls reach Stripe and send an `Idempotency-Key` |
| `entitlements/admin.ts` | `/admin/entitlements/*`, `/admin/customers/{ref}/entitlements` | Per-access extend / suspend / reinstate / revoke with a reason |
| `settings/settings.ts` | `/admin/settings/*` | |
| `learning/bundles.ts`, `system/fx.ts`, `analytics/behavior.ts` | `/admin/bundles`, `/admin/fx`, `/admin/analytics` | Pure-B2C module APIs |
| `search/search.ts`, `system/health.ts`, `learning/experts.ts` | `/search`, `/health`, `/legacy/*` | Public read APIs |

Each module follows the same pattern: `<area>Paths`, `<area>Keys` (React Query keys) and `<area>Queries` (`queryOptions`), plus service functions.

To show a simple resource as a table, pass its query to `AdminListPanel` (`components/ui/admin-list-panel.tsx`), as `pages/panels.tsx` does.

## 6. Adding a screen or an endpoint

1. **Endpoint first.** Add the resource to the backend admin module (see its `ADMIN_API.md`, "Adding or changing an admin resource"). Never call another backend API to get around it.
2. Re-export `openapi.json` and run `npm run api:types`.
3. Add the operation to the area's module in `src/lib/api/`: an operation type alias, a path, keys, queries and a service function.
4. In the page:
   - use refs for links and route params;
   - show `SourceBadge` for federated items;
   - disable B2C-only actions with `isLegacy`;
   - surface `ApiError` with `ErrorAlert`.
5. Verify:
   - `npx tsc -b`, `npm run lint`;
   - `npm run test:api`: live read checks against the backend; add a check for the new endpoint in `scripts/test-api-layer.ts`;
   - `npm run test:api:mutations` also exercises writes, but it creates records in the dev database.

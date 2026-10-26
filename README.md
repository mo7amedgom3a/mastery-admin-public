# Mastery Admin Dashboard

Back-office admin for Mastery Academy. React + Vite + TypeScript, a faithful port of the
clickable prototype in `admin_demo/` (the HTML/CSS/JS reference build), wired to the live backend
at `http://localhost:8000`. It is an internal app — not part of the public Next.js site.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (or any free port)
```

- The Vite dev server proxies `/api/*` to the backend (`vite.config.ts`), so the backend's
  httpOnly admin cookies work first-party — no tokens in JS, no CORS.
- The dashboard has **one backend API**: the admin module (`/api/v1/admin/*`), which serves B2C and
  legacy-platform data together (items carry `source` and a `ref`). How the two sides talk, and why,
  is in [ADMIN_API.md](ADMIN_API.md).
- Cloudflare Pages: set the project root to this directory, build with `npm run build`, and use
  `dist` as the output directory. The Pages Function in `functions/api/[[path]].js` proxies
  `/api/*` to the runtime `API_PROXY_TARGET` binding (for example,
  `https://masteryacademy.site`). Publish with Git integration or Wrangler so Pages deploys
  the Function alongside the static assets. The `public/_routes.json` file limits Function
  invocations to API requests.
- Sign in at `/login` (`admin@masteryacademy.site` / `Admin@12345` in dev). Session store:
  `src/lib/auth/store.ts` (zustand, silent refresh, cross-tab BroadcastChannel).

## Where it comes from

The prototype (`admin_demo/`) is the source of truth for layout, styles and interaction. This app
ports it 1:1:

| Prototype | React port |
| --- | --- |
| `admin/js/components/shell.js` | `src/components/layout/shell.tsx` (rail + sidebar + topbar + drawer + rail preview) |
| `admin/js/components/command-palette.js` | `src/components/layout/command-palette.tsx` (Ctrl/⌘ K) |
| `admin/js/components/ui.js` | `src/components/ui/kit.tsx` (`Kpi`, `Card`, `Bars`, `Badge`, `Alert`, `Empty`, `Field`, `Dl`, `PageHead`, `PageTabs`, `Button`, `Avatar`) |
| `admin/js/components/icons.js` | `src/components/ui/icon.tsx` (kit sprite `i-*` + square-cap line icons) |
| `admin/js/config/navigation.js` | `src/config/navigation.ts` |
| `admin/css/admin.css`, `design-system/*` | `src/styles/*` (verbatim) |
| `admin/js/i18n.js` | `src/lib/i18n.ts` (Arabic-first RTL + English toggle) |
| `admin-demo` theme handling | `src/lib/theme.ts` + `App.tsx` (`[data-theme]` on `<html>`) |

Styling is the Mastery design kit (`tokens.css` / `components.css`) plus the prototype's
`admin.css`, layered with Tailwind utilities where layout needs them. **No hand-rolled colours**;
brand colours come only from tokens.

## Structure

```
src/
  config/navigation.ts   rail domains + sidebar sections (single source for nav/search/active)
  lib/
    api/                 typed service layer, one folder per category:
                           client.ts            fetch wrapper (same-origin, path/query interpolation)
                           operation-types.ts   SuccessResponse/RequestBody/QueryParams by operationId
                           contract.ts          aliases of generated schemas + UI helpers (Page, Row)
                           auth/ iam/ dashboard/ sales/ customers/ learning/
                           marketing/ analytics/ settings/ system/ search/
                         each module exports services, `<area>Keys` and `<area>Queries` (queryOptions)
    auth/store.ts        admin session store
    i18n.ts theme.ts     language + theme stores
    permissions.ts       scope checks (presentation only; the API enforces)
    refs.ts              links and short ids from refs (`b2c:<uuid>`, `legacy:<kind>:<id>`), isLegacy
    format.ts dates.ts status.ts
  types/openapi.ts       generated from openapi.json (npm run api:types)
  components/
    layout/              shell.tsx, command-palette.tsx
    ui/                  kit.tsx, icon.tsx,
                         data-table.tsx (shadcn DataTable on @tanstack/react-table + kit tokens),
                         table.tsx / dropdown-menu.tsx / select.tsx / checkbox.tsx (Radix, kit tokens),
                         info-hint.tsx (Radix Popover), paged-list.tsx, primitives.tsx,
                         chart.tsx (shadcn/recharts)
    icons/ motion/       vendored animated icons (lucide-animated) + motion helpers
  pages/                 dashboard, orders, customers, team, audit, tickets, affiliates,
                         payouts, coupons, refunds, payments, catalog, consultations,
                         reports, banners, inbox, panels, placeholder, login
  routes/                router.tsx + guard.tsx
  styles/                tokens, components, admin, charts, patterns
scripts/
  test-api-layer.ts      live endpoint test runner (see Checks)
```

Icons: rail, sidebar, buttons and cards use `src/components/ui/icon.tsx`. The animated icons from
mastery-front (`src/components/icons/animated-icons.tsx`, `motion/`) are vendored for use in
actions where motion adds meaning.

## Shared UI components (from mastery-front)

Buttons, links and interactive elements are built on the same primitives as the public site so the
two stay consistent:

| Component | Port of | Used for |
| --- | --- | --- |
| `ui/button.tsx` — `Button`, `ButtonLink`, `buttonClass` | `mastery-front/src/components/ui/button.tsx` | every `.ma-btn` in the app (the kit `Button`/`IconButton` delegate here) |
| `ui/app-link.tsx` | `mastery-front/src/components/ui/app-link.tsx` (react-router) | all internal links |
| `ui/view-all-link.tsx` | mastery-front | "view all" links, animated forward arrow |
| `theme/theme-toggle.tsx` | `mastery-front/src/components/theme/theme-toggle.tsx` | topbar light/dark switch, animated sun/moon |
| `icons/animated-icons.tsx` + `motion/count-up.tsx` | mastery-front | animated menu icon, KPI count-up |

Icons passed to buttons use `Icon` (line icons); pass `iconNode` to use an animated icon instead.

### Data tables (shadcn + TanStack Table, on kit tokens)

Tables are shadcn's DataTable recipe — `@tanstack/react-table` for the model, Radix for the
interactive bits — restyled onto the Mastery kit tokens so the visual language stays ours:

| Piece | Stack | Notes |
| --- | --- | --- |
| `ui/data-table.tsx` — `DataTable` / `Column<T>` | `@tanstack/react-table` | sorting (`getSortedRowModel`, `aria-sort` headers), column visibility |
| `ui/table.tsx`, `ui/dropdown-menu.tsx`, `ui/select.tsx`, `ui/checkbox.tsx` | Radix UI primitives | shadcn structure, `ma-*` classes + tokens (no raw colours) |
| `ui/paged-list.tsx` — `PagedList` | — | server-side search, filters (Radix `Select` → API query params), pagination |
| `ui/info-hint.tsx` — `InfoHint` | Radix Popover | the ⓘ explanations on chart cards |

Sorting runs on the current page; filtering and paging stay server-side. Table toolbar filters map
straight to API query params (e.g. orders `status`/`payment_status`, catalog `published`).


## Charts

`src/components/ui/chart.tsx` is the shadcn/ui chart layer on **recharts**, dressed on the kit
(`ChartContainer`, `ChartTooltip(Content)`, `ChartLegend(Content)`; token colours via
`--color-<key>`; styling in `src/styles/charts.css`). The dashboard uses it for **الإيرادات
اليومية / Daily revenue** (current period solid coral vs. previous period dashed purple, y-axis
from 0) and the **الدورات الأعلى إيرادًا** bars use the kit palette.

Reports return **daily totals** and **per-course range totals**; a per-course daily series needs a
new endpoint to draw per-course lines.

## Pages

| Route | Status |
| --- | --- |
| `/dashboard` | Live: KPIs, daily-revenue chart, top courses, platform numbers, latest orders |
| `/dashboard/inbox` | Live: support-ticket / payout / failed-payment counts |
| `/sales/overview` | Live: 30-day revenue KPIs, top courses, all-time figures |
| `/sales/orders` | Live: paged, status filter, email search |
| `/sales/payments` | Live: failed payments + refunds tabs |
| `/sales/refunds` | Live: refunds list |
| `/sales/invoices` | Live: orders with invoice counts |
| `/sales/coupons` | Live: legacy promotions + activate/deactivate |
| `/sales/coupons/new` | Live: create a legacy coupon |
| `/sales/offers`, `/sales/price-lists` | Live: legacy marketing reads |
| `/customers` | Live: legacy directory ↔ B2C, search, paging |
| `/customers/segments` | Live: legacy user groups |
| `/customers/tickets` | Live: legacy tickets, detail, status + reply |
| `/settings/team` | Live: admin accounts (create, suspend/activate) + roles |
| `/settings/general` | Live: legacy reference data (countries, social, tags, modules) |
| `/settings/audit` | Live: audit log with entity-type filter |
| `/settings/notifications` | Live: legacy admin notification emails |
| `/marketing/affiliates` | Live: referral partners + approve |
| `/marketing/payouts`, `/marketing/commissions` | Live: payout requests, commissions |
| `/marketing/announcements`, `/marketing/banners` | Live: legacy ads / banners / sliders |
| `/analytics/sales`, `/products`, `/coupons`, `/customers`, `/affiliates` | Live: legacy reports |
| `/analytics/ratings`, `/analytics/certificates` | Live: legacy mirror resources |
| `/learning/courses`, `/packages` | Live: catalog + publish/unpublish |
| `/learning/courses/new` | Live: create a legacy course |
| `/learning/consultations`, `/instructors`, `/categories`, `/applications` | Live: legacy reads |
| `/learning/certificates` | Live: legacy mirror certificates |
| `/learning/qa`, `/settings/integrations` | Empty state — no backend endpoint yet |

## Checks

```bash
npx tsc -b            # typecheck
npx oxlint src        # lint
npm run build         # production build

npm run api:types     # regenerate src/types/openapi.ts from openapi.json
npm run test:api      # live read tests against http://localhost:8000 (offline client tests too)
npm run test:api:mutations   # also exercises every POST/PATCH/PUT/DELETE
```

`scripts/test-api-layer.ts` logs in as the dev admin, keeps a cookie jar, and walks every admin +
legacy-admin endpoint. The offline section stubs `fetch` to check URL/query/body/error handling.
Mutations only run with `--include-mutations`; back-office writes that the backend has disabled
(`LEGACY_ADMIN_LOCAL_WRITES_ENABLED`) are reported as skips. Env overrides: `API_BASE_URL`,
`API_TEST_ADMIN_EMAIL`, `API_TEST_ADMIN_PASSWORD`, `API_TEST_DELAY_MS`, `API_TEST_MAX_RETRIES`.

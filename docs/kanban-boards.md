# Company and sales boards

Companies (`/companies`) use the existing request statuses and request PATCH API. The module accepts `admin:catalog:read` for viewing; moves require `admin:catalog:write`.

Orders (`/sales/orders`) use separate admin follow-up stages: `new`, `in_progress`, `failure`, `success`, `not_completed`. Moves require `admin:orders:write` and support B2C and legacy references. They do not change payments, fulfillment, access, refunds, or legacy commerce records.

`GET /api/v1/admin/orders` accepts `follow_up_status`. List and detail responses expose the effective stage. `PATCH /api/v1/admin/orders/{order_ref}/follow-up` accepts `{ "follow_up_status": "in_progress" }`, validates the order and stage, records an audit entry, and returns updated detail. Stored overrides always win; concurrent saves use the last committed update.

Without an override, the backend infers Not completed for cancelled/expired/refunded/partially refunded/incomplete states, Failure for failed payment, Success for paid/fulfilled/succeeded states, otherwise New, in that precedence. In progress is manual.

Both views share filters. Each board column loads 25 records with server-side counts and a Load more button. Tables retain their export controls. Moves refresh boards, counts, tables, and details; board save errors restore the card to its previous column. Other users' board changes refresh every 30 seconds.

## Release order

1. Apply `newwebsitebackend/migrations/20261213_admin_order_follow_ups.sql` using the existing SQL Server migration process. It creates only the admin annotation table and is safe to rerun.
2. Deploy `newwebsitebackend` with the new follow-up API and list filter.
3. Deploy `mastery-admin-public` after the backend is ready. The new frontend requires the new API; do not deploy it first.
4. Smoke-test moving one company and one B2C/legacy order, refreshing each, and opening their details. Verify a read-only account cannot move cards.

The migration is additive; a frontend rollback can return to the former table UI while leaving stored stages intact. Keep the migration while any version of the new backend is running.

## Local verification

Frontend: `npm run build`, `npm run lint`, and `npx playwright test --config playwright.kanban.config.ts`. The isolated browser suite mocks API responses, starts Vite on port 5175, and needs no QA credentials. It does not mutate live data.

Backend: `.venv/bin/python -m pytest tests/unit/admin/test_order_follow_up.py tests/unit/admin/test_federated_commerce.py tests/unit/admin/test_admin_resource_endpoints.py tests/unit/admin/test_legacy_mappers.py tests/unit/admin/test_admin_routes_inventory.py tests/unit/orders -q`.

SQL expressions are exercised with SQLite fixtures and federated query assembly is checked separately. Applying the migration and validating MERGE against SQL Server remain release checks.

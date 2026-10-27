import { useAdminAuth } from "@/lib/auth/store";
import { flatItems, navigation } from "@/config/navigation";
import type { FlatNavItem, NavItem, NavModule } from "@/config/navigation";

/**
 * Presentation-level permission checks for navigation and actions. The API enforces every scope;
 * hiding an item is not authorization. Super admins (`*`) see everything.
 *
 * An area may accept several scopes: the marketing pages, for example, are reachable both with the
 * dedicated marketing scopes and with the legacy catalog/operations scopes that older policies
 * still grant.
 */
const AREA_SCOPE: Record<string, string | string[]> = {
  dashboard: "admin:operations:read",
  orders: "admin:orders:read",
  payments: "admin:orders:read",
  refunds: "admin:orders:read",
  invoices: "admin:orders:read",
  coupons: ["admin:promotions:read", "admin:promotions:write", "admin:catalog:read", "admin:catalog:write"],
  pricing: ["admin:promotions:read", "admin:promotions:write", "admin:catalog:read", "admin:catalog:write"],
  courses: "admin:catalog:read",
  packages: "admin:catalog:read",
  categories: "admin:catalog:read",
  // Course Studio: editing and publishing product pages.
  studio: "admin:catalog:write",
  consultations: "admin:consultations:read",
  // Add/edit availability and reschedule bookings.
  consultationsWrite: "admin:consultations:write",
  instructors: "admin:catalog:read",
  // Manual expert creation and profile writes; the API enforces `admin:catalog:write`.
  instructorsWrite: "admin:catalog:write",
  // Subscription plans (catalog scopes) and subscribers (entitlement scopes).
  subscriptions: "admin:catalog:read",
  subscriptionsWrite: "admin:catalog:write",
  subscribers: "admin:entitlements:read",
  subscribersManage: "admin:entitlements:manage",
  certificates: "admin:operations:read",
  qa: "admin:operations:read",
  customers: "admin:customers:read",
  tickets: "admin:operations:read",
  affiliates: ["admin:affiliates:read", "admin:operations:read"],
  // Create/approve affiliates, issue their coupons, approve commissions, referral program settings.
  affiliatesWrite: ["admin:affiliates:manage", "admin:operations:manage"],
  marketing: ["admin:marketing:read", "admin:marketing:write", "admin:catalog:read", "admin:catalog:write"],
  reports: ["admin:operations:read", "admin:analytics:read", "admin:marketing:read"],
  settings: "admin:operations:read",
  audit: ["admin:audit:read", "admin:operations:read"],
  // Access management (groups, policies, audit traces).
  iam: ["admin:iam:read", "admin:iam:manage"],
  access: ["admin:iam:read", "admin:iam:manage"],
};

/**
 * Write actions, checked before the area fallback so a read-only policy never unlocks them.
 * Each entry lists the scopes the matching API route accepts (see the backend route guards).
 */
const ACTION_SCOPE: Record<string, string[]> = {
  "orders.write": ["admin:orders:write"],
  "payments.refund": ["admin:payments:refund"],
  "refunds.write": ["admin:payments:refund"],
  "coupons.write": ["admin:promotions:write", "admin:catalog:write"],
  "pricing.write": ["admin:catalog:write"],
  "catalog.write": ["admin:catalog:write"],
  "courses.write": ["admin:catalog:write"],
  "categories.write": ["admin:catalog:write"],
  "customers.write": ["admin:customers:write"],
  "tickets.write": ["admin:customers:write", "admin:operations:manage"],
  "marketing.write": ["admin:marketing:write", "admin:catalog:write"],
  "operations.manage": ["admin:operations:manage"],
  "settings.write": ["admin:operations:manage"],
  "iam.manage": ["admin:iam:manage"],
};

function scopesSatisfy(scopes: string[], needed: string | string[]): boolean {
  const accepted = Array.isArray(needed) ? needed : [needed];
  return accepted.some((scope) => scopes.includes(scope));
}

export function canWithScopes(scopes: string[] | undefined, permission: string): boolean {
  if (!scopes) return false;
  if (scopes.includes("*")) return true;
  const action = ACTION_SCOPE[permission];
  if (action) return scopesSatisfy(scopes, action);
  const area = permission.split(".")[0];
  const scope = AREA_SCOPE[area];
  return scope ? scopesSatisfy(scopes, scope) : false;
}

/** True when the caller may change IAM state (team lead or super admin). */
export function canManageAccess(scopes: string[] | undefined): boolean {
  if (!scopes) return false;
  return scopes.includes("*") || scopes.includes("admin:iam:manage");
}

/** Reactive check for components: re-renders when the admin's scopes change. */
export function useCan(permission: string): boolean {
  return useAdminAuth((state) => canWithScopes(state.admin?.scopes, permission));
}

/** Non-reactive check for render-time filtering (SCRUM: super admin sees all). */
export function can(permission: string): boolean {
  return canWithScopes(useAdminAuth.getState().admin?.scopes, permission);
}

/** True when an item inside a visible module is allowed. */
export function canSeeNavItem(item: NavItem, scopes?: string[]): boolean {
  if (!scopes) return false;
  return !item.permission || canWithScopes(scopes, item.permission);
}

/**
 * Domain-level access: a module (and its rail entry) is visible only when the admin
 * holds one of its `scopes`. Item permissions still narrow what appears inside, so a
 * marketer gets the Marketing domain and a salesperson gets Sales + Reports.
 */
export function canSeeModule(module: NavModule, scopes?: string[]): boolean {
  if (!scopes) return false;
  if (scopes.includes("*")) return true;
  if (module.scopes?.length) {
    return module.scopes.some((scope) => scopes.includes(scope));
  }
  return module.sections.some((section) =>
    section.items.some((item) => canSeeNavItem(item, scopes)),
  );
}

/**
 * Resolve the navigation entry for a path, preferring a copy that belongs to a domain the
 * admin can actually see. Coupons live under both Sales and Marketing, for example, so a
 * marketer resolves `/sales/coupons` to the Marketing entry (and a salesperson to Sales).
 */
export function resolveActiveItem(path: string, scopes?: string[]): FlatNavItem | null {
  const matches = flatItems(navigation).filter(
    (item) => path === item.href || path.startsWith(`${item.href}/`),
  );
  const allowed = matches.filter(
    (item) => canSeeModule(item.module, scopes) && canSeeNavItem(item, scopes),
  );
  const pool = allowed.length ? allowed : matches;
  return pool.reduce<FlatNavItem | null>(
    (best, item) => (!best || item.href.length > best.href.length ? item : best),
    null,
  );
}

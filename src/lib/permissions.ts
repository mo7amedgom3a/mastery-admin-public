import { useAdminAuth } from "@/lib/auth/store";

/**
 * Presentation-level permission checks for navigation and actions. The API enforces every scope;
 * hiding an item is not authorization. Super admins (`*`) see everything.
 */
const AREA_SCOPE: Record<string, string> = {
  dashboard: "admin:operations:read",
  orders: "admin:orders:read",
  payments: "admin:orders:read",
  refunds: "admin:orders:read",
  invoices: "admin:orders:read",
  coupons: "admin:catalog:write",
  pricing: "admin:catalog:write",
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
  affiliates: "admin:operations:read",
  // Create/approve affiliates, issue their coupons, approve commissions, referral program settings.
  affiliatesWrite: "admin:operations:manage",
  marketing: "admin:operations:read",
  reports: "admin:operations:read",
  settings: "admin:operations:read",
};

export function canWithScopes(scopes: string[] | undefined, permission: string): boolean {
  if (!scopes) return false;
  if (scopes.includes("*")) return true;
  const area = permission.split(".")[0];
  const scope = AREA_SCOPE[area];
  return scope ? scopes.includes(scope) : false;
}

/** Non-reactive check for render-time filtering (SCRUM: super admin sees all). */
export function can(permission: string): boolean {
  return canWithScopes(useAdminAuth.getState().admin?.scopes, permission);
}

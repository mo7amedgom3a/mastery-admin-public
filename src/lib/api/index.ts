/**
 * Admin API layer — one module per back-office category. Every module exports plain service
 * functions, React Query key factories (`<area>Keys`) and `queryOptions` factories (`<area>Queries`).
 * Types are derived from `@/types/openapi` via `operation-types`. Every back-office resource is served by
 * the admin module (`/api/v1/admin/*`) over B2C and the legacy platform; federated items carry `source`
 * (`b2c` | `legacy`) and a `ref`.
 */

export * from "@/lib/api/client";
export * from "@/lib/api/contract";
export * from "@/lib/api/operation-types";

// Auth & access control
export * from "@/lib/api/auth/admin-auth";
export * from "@/lib/api/iam/rbac";
export * from "@/lib/api/iam/access";

// Dashboard
export * from "@/lib/api/dashboard/dashboard";

// Sales
export * from "@/lib/api/sales/orders";
export * from "@/lib/api/sales/payments";
export * from "@/lib/api/sales/refund-cases";

// Customers
export * from "@/lib/api/customers/customers";
export * from "@/lib/api/customers/customer-admin";
export * from "@/lib/api/entitlements/admin";
export * from "@/lib/api/customers/tickets";

// Learning
export * from "@/lib/api/learning/catalog";
export * from "@/lib/api/learning/certificates";
export * from "@/lib/api/learning/studio";
export * from "@/lib/api/learning/curriculum";
export * from "@/lib/api/learning/bundles";
export * from "@/lib/api/learning/live-diplomas";
export * from "@/lib/api/learning/pricing";
export * from "@/lib/api/learning/consultations";
export * from "@/lib/api/learning/consultants";
export * from "@/lib/api/learning/expert-profiles";
export * from "@/lib/api/learning/experts";
export * from "@/lib/api/learning/instructors";

// Consultations (B2C)
export * from "@/lib/api/consultations/admin";

// Subscriptions (B2C)
export * from "@/lib/api/subscriptions/admin";

// Marketing
export * from "@/lib/api/marketing/promotions";
export * from "@/lib/api/marketing/coupons";
export * from "@/lib/api/marketing/vouchers";
export * from "@/lib/api/marketing/affiliates";
export * from "@/lib/api/marketing/referrals";
export * from "@/lib/api/marketing/content";

// Analytics & reporting
export * from "@/lib/api/analytics/reports";
export * from "@/lib/api/analytics/behavior";

// Search
export * from "@/lib/api/search/search";

// Settings & system
export * from "@/lib/api/settings/settings";
export * from "@/lib/api/system/health";
export * from "@/lib/api/system/fx";

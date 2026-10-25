import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";

import {
  contentQueries,
  productQueries,
  promotionsQueries,
  referralsQueries,
  settingsQueries,
  customersQueries,
} from "@/lib/api";
import { AdminListPanel } from "@/components/ui/admin-list-panel";
import { RequestInboxPage } from "@/features/learning/pages/request-inbox-page";

/** Admin API query options as the panel's untyped `query` (the panel renders any page/array/object). */
const q = (options: unknown) => options as UseQueryOptions<unknown, Error, unknown, QueryKey>;

export function AnnouncementsPage() {
  return (
    <AdminListPanel
      titleAr="أشرطة الإعلانات"
      titleEn="Announcement bars"
      subAr="أشرطة الإعلانات المعروضة على الموقع."
      subEn="Announcement bars shown on the site."
      query={q(contentQueries.announcements({ limit: 200 }))}
      columns={["title", "body", "placement", "active", "published_at", "link"]}
    />
  );
}

export function InstructorApplicationsPage() {
  return <RequestInboxPage kind="trainer-applications" />;
}

export function CompanyRequestsPage() {
  return <RequestInboxPage kind="company-training" />;
}

export function CommissionsPage() {
  return (
    <AdminListPanel
      titleAr="العمولات"
      titleEn="Commissions"
      subAr="نسبة عمولة الإحالة لكل منتج."
      subEn="Referral commission per product."
      query={q(referralsQueries.commissions({ limit: 200 }))}
      columns={["product_kind", "product_ref", "commission"]}
    />
  );
}

export function AffiliatesReportPage() {
  return (
    <AdminListPanel
      titleAr="تقرير المسوقين"
      titleEn="Affiliates report"
      subAr="شركاء الإحالة وحالتهم."
      subEn="Referral partners and their status."
      query={q(referralsQueries.partners({ limit: 200 }))}
      columns={["name", "email", "referral_code", "status", "country", "joined_at"]}
    />
  );
}

export function OffersPage() {
  return (
    <AdminListPanel
      titleAr="العروض"
      titleEn="Offers"
      subAr="عروض المتجر وشروطها."
      subEn="Storefront offers and their rules."
      query={q(promotionsQueries.offers({ limit: 200 }))}
      columns={["title", "type", "starts_at", "ends_at", "active"]}
    />
  );
}

export function PriceListsPage() {
  return (
    <AdminListPanel
      titleAr="قوائم الأسعار"
      titleEn="Price lists"
      subAr="قوائم الأسعار والحملات."
      subEn="Price lists and campaigns."
      query={q(productQueries.priceLists({ limit: 200 }))}
      columns={["name", "price", "starts_at", "ends_at"]}
    />
  );
}

export function CategoriesPage() {
  return (
    <AdminListPanel
      titleAr="التصنيفات"
      titleEn="Categories"
      subAr="تصنيفات الدورات."
      subEn="Course categories."
      query={q(productQueries.categories({ limit: 200 }))}
      columns={["name", "description", "order", "category_id"]}
    />
  );
}

export function NotificationsPage() {
  return (
    <AdminListPanel
      titleAr="الإشعارات"
      titleEn="Notifications"
      subAr="بُرد الإشعارات الإدارية."
      subEn="Admin notification emails."
      query={q(settingsQueries.notificationEmails())}
      columns={["type", "email"]}
    />
  );
}

export function CertificatesPage() {
  return (
    <AdminListPanel
      titleAr="الشهادات"
      titleEn="Certificates"
      subAr="قوالب الشهادات التي تمنحها الدورات."
      subEn="Certificate templates awarded by courses."
      query={q(productQueries.certificateTemplates({ limit: 200 }))}
      columns={["legacy_certificate_id", "name", "description"]}
    />
  );
}

export function RatingsPage() {
  return (
    <AdminListPanel
      titleAr="التقييمات"
      titleEn="Ratings"
      subAr="تقييمات الدورات ومراجعاتها."
      subEn="Course ratings and reviews."
      query={q(productQueries.allRatings({ limit: 200 }))}
      columns={["product_ref", "rating", "review", "legacy_user_id", "created_at"]}
    />
  );
}

export function SegmentsPage() {
  return (
    <AdminListPanel
      titleAr="الشرائح"
      titleEn="Segments"
      subAr="مجموعات المستخدمين."
      subEn="User groups."
      query={q(customersQueries.segments({ limit: 200 }))}
      columns={["legacy_group_id", "name", "notes", "created_at"]}
    />
  );
}

import { Navigate, createBrowserRouter } from "react-router-dom";

import { Shell } from "@/components/layout/shell";
import { RequireAdmin } from "@/routes/guard";
import DashboardPage from "@/features/dashboard/pages/dashboard-page";
import InboxPage from "@/features/dashboard/pages/inbox-page";
import SalesOverviewPage from "@/features/sales/pages/sales-overview-page";
import OrdersPage from "@/features/sales/pages/orders-page";
import OrderDetailPage from "@/features/sales/pages/order-detail-page";
import PaymentsPage from "@/features/sales/pages/payments-page";
import PaymentDetailPage from "@/features/sales/pages/payment-detail-page";
import RefundsPage from "@/features/sales/pages/refunds-page";
import RefundCaseDetailPage from "@/features/sales/pages/refund-case-detail-page";
import InvoicesPage from "@/features/sales/pages/invoices-page";
import CouponsPage from "@/features/marketing/pages/coupons-page";
import CouponNewPage from "@/features/marketing/pages/coupon-new-page";
import CouponDetailPage from "@/features/marketing/pages/coupon-detail-page";
import VouchersPage from "@/features/marketing/pages/vouchers-page";
import VoucherIssuePage from "@/features/marketing/pages/voucher-issue-page";
import VoucherDetailPage from "@/features/marketing/pages/voucher-detail-page";
import CustomersPage from "@/features/customers/pages/customers-page";
import CustomerDetailPage from "@/features/customers/pages/customer-detail-page";
import AccountsPage from "@/features/customers/pages/accounts-page";
import EntitlementsPage from "@/features/entitlements/pages/entitlements-page";
import PricingPage from "@/features/pricing/pages/pricing-page";
import TicketsPage from "@/features/customers/pages/tickets-page";
import TicketDetailPage from "@/features/customers/pages/ticket-detail-page";
import TeamPage from "@/features/settings/pages/team-page";
import AuditPage from "@/features/settings/pages/audit-page";
import GeneralSettingsPage from "@/features/settings/pages/general-settings-page";
import PartnersPage from "@/features/marketing/pages/partners-page";
import PartnerNewPage from "@/features/marketing/pages/partner-new-page";
import PartnerDetailPage from "@/features/marketing/pages/partner-detail-page";
import AffiliateCommissionsPage from "@/features/marketing/pages/affiliate-commissions-page";
import AffiliateImportPage from "@/features/marketing/pages/affiliate-import-page";
import ReferralProgramPage from "@/features/marketing/pages/referral-program-page";
import AffiliatesAnalyticsPage from "@/features/marketing/pages/affiliates-analytics-page";
import PayoutsPage from "@/features/marketing/pages/payouts-page";
import CatalogPage from "@/features/learning/pages/catalog-page";
import CourseNewPage from "@/features/learning/pages/course-new-page";
import PackageNewPage from "@/features/learning/pages/package-new-page";
import ConsultationNewPage from "@/features/learning/pages/consultation-new-page";
import BundleNewPage from "@/features/learning/pages/bundle-new-page";
import LiveDiplomaNewPage from "@/features/learning/pages/live-diploma-new-page";
import ProductDetailPage from "@/features/learning/pages/product-detail-page";
import CourseStudioPage from "@/features/learning/studio/pages/course-studio-page";
import ConsultationsPage from "@/features/learning/pages/consultations-page";
import ConsultationsOverviewPage from "@/features/consultations/pages/overview-page";
import LiveMeetingsPage from "@/features/consultations/pages/live-page";
import ConsultationExpertsPage from "@/features/consultations/pages/experts-page";
import ExpertDetailPage from "@/features/consultations/pages/expert-detail-page";
import ConsultationBookingsPage from "@/features/consultations/pages/bookings-page";
import BookingDetailPage from "@/features/consultations/pages/booking-detail-page";
import ConsultationOrdersPage from "@/features/consultations/pages/orders-page";
import SubscriptionsOverviewPage from "@/features/subscriptions/pages/overview-page";
import SubscriptionPlansPage from "@/features/subscriptions/pages/plans-page";
import SubscriptionPlanNewPage from "@/features/subscriptions/pages/plan-new-page";
import SubscriptionPlanDetailPage from "@/features/subscriptions/pages/plan-detail-page";
import SubscribersPage from "@/features/subscriptions/pages/subscribers-page";
import SubscriptionFeaturesPage from "@/features/subscriptions/pages/features-page";
import SubscriberDetailPage from "@/features/subscriptions/pages/subscriber-detail-page";
import TeamLeadsPage from "@/features/subscriptions/pages/team-leads-page";
import TeamLeadDetailPage from "@/features/subscriptions/pages/team-lead-detail-page";
import CompanyInsightsPage from "@/features/subscriptions/pages/company-insights-page";
import ConsultationDetailPage from "@/features/learning/pages/consultation-detail-page";
import ConsultantsPage from "@/features/learning/pages/consultants-page";
import ConsultantDetailPage from "@/features/learning/pages/consultant-detail-page";
import InstructorsPage from "@/features/learning/pages/instructors-page";
import ExpertStudioPage from "@/features/learning/expert-profile/expert-studio-page";
import InstructorDetailPage from "@/features/learning/pages/instructor-detail-page";
import AnalyticsSalesPage, {
  CouponsReportPage,
  CustomersReportPage,
  ProductsReportPage,
} from "@/features/analytics/pages/reports-page";
import BannersPage from "@/features/marketing/pages/banners-page";
import PoliciesPage from "@/features/marketing/pages/policies-page";
import BehaviorOverviewPage from "@/features/analytics/pages/behavior-page";
import FunnelsPage from "@/features/analytics/pages/funnels-page";
import BehaviorMapPage from "@/features/analytics/pages/behavior-map-page";
import SearchPage from "@/features/dashboard/pages/search-page";
import {
  AffiliatesReportPage,
  AnnouncementsPage,
  CategoriesPage,
  CertificatesPage,
  CommissionsPage,
  InstructorApplicationsPage,
  CompanyRequestsPage,
  NotificationsPage,
  OffersPage,
  PriceListsPage,
  RatingsPage,
  SegmentsPage,
} from "@/pages/panels";
import LegacyCatalogRedirect from "@/pages/legacy-catalog-redirect";
import PlaceholderPage from "@/pages/placeholder";
import LoginPage from "@/pages/login";
import NotFoundPage, { RouteErrorPage } from "@/pages/not-found";

const ph = (ar: string, en: string) => <PlaceholderPage titleAr={ar} titleEn={en} />;

export const ROUTER = createBrowserRouter([
  { path: "/login", element: <LoginPage />, errorElement: <RouteErrorPage /> },
  {
    path: "/",
    element: (
      <RequireAdmin>
        <Shell />
      </RequireAdmin>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // Home
      { path: "dashboard", element: <DashboardPage /> },
      { path: "dashboard/inbox", element: <InboxPage /> },
      { path: "search", element: <SearchPage /> },

      // Sales
      { path: "sales/overview", element: <SalesOverviewPage /> },
      { path: "sales/orders", element: <OrdersPage /> },
      { path: "sales/orders/:id", element: <OrderDetailPage /> },
      { path: "sales/payments", element: <PaymentsPage /> },
      { path: "sales/payments/:id", element: <PaymentDetailPage /> },
      { path: "sales/refunds", element: <RefundsPage /> },
      { path: "sales/refunds/:id", element: <RefundCaseDetailPage /> },
      { path: "sales/invoices", element: <InvoicesPage /> },
      { path: "sales/coupons", element: <CouponsPage /> },
      { path: "sales/coupons/new", element: <CouponNewPage /> },
      { path: "sales/coupons/:promotionId", element: <CouponDetailPage /> },
      { path: "sales/vouchers", element: <VouchersPage /> },
      { path: "sales/vouchers/new", element: <VoucherIssuePage /> },
      { path: "sales/vouchers/:voucherId", element: <VoucherDetailPage /> },
      { path: "sales/pricing", element: <PricingPage /> },
      { path: "sales/price-lists", element: <PriceListsPage /> },
      { path: "sales/offers", element: <OffersPage /> },

      // Learning
      { path: "learning/courses", element: <CatalogPage defaultType="course" /> },
      { path: "learning/courses/new", element: <CourseNewPage /> },
      { path: "learning/diplomas", element: <CatalogPage defaultType="diploma" /> },
      { path: "learning/live", element: <CatalogPage defaultType="live_diploma" /> },
      { path: "learning/live-diplomas", element: <Navigate to="/learning/live" replace /> },
      { path: "learning/live-diplomas/new", element: <LiveDiplomaNewPage /> },
      { path: "learning/bundles", element: <CatalogPage defaultType="package" /> },
      { path: "learning/bundles/new", element: <PackageNewPage /> },
      { path: "learning/packages", element: <CatalogPage defaultType="bundle" /> },
      { path: "learning/packages/new", element: <BundleNewPage /> },
      { path: "learning/catalog", element: <CatalogPage /> },
      { path: "learning/catalog/:productId", element: <ProductDetailPage /> },
      // Full-width workspace: the shell hides its sidebar for routes with `handle.studio`.
      { path: "learning/catalog/:productId/studio", element: <CourseStudioPage />, handle: { studio: true } },
      { path: "learning/backoffice", element: <Navigate to="/learning/catalog" replace /> },
      { path: "learning/backoffice/:kind/:legacyId", element: <LegacyCatalogRedirect /> },
      { path: "learning/categories", element: <CategoriesPage /> },
      { path: "learning/consultations", element: <ConsultationsPage /> },
      { path: "learning/consultations/new", element: <ConsultationNewPage /> },
      { path: "learning/consultations/:id", element: <ConsultationDetailPage /> },
      { path: "learning/consultants", element: <ConsultantsPage /> },
      { path: "learning/consultants/:id", element: <ConsultantDetailPage /> },
      { path: "learning/instructors", element: <InstructorsPage /> },
      { path: "learning/instructors/:trainerId", element: <InstructorDetailPage /> },
      { path: "learning/instructors/:trainerId/studio", element: <ExpertStudioPage />, handle: { studio: true } },
      { path: "learning/instructors/:trainerId/:tab", element: <InstructorDetailPage /> },
      { path: "learning/applications", element: <InstructorApplicationsPage /> },
      { path: "learning/applications/:id", element: <InstructorApplicationsPage /> },
      { path: "trainers", element: <Navigate to="/learning/instructors" replace /> },
      { path: "trainers/applications", element: <Navigate to="/learning/applications" replace /> },
      { path: "instructors", element: <Navigate to="/learning/instructors" replace /> },
      { path: "instructors/applications", element: <Navigate to="/learning/applications" replace /> },
      { path: "learning/company-requests", element: <Navigate to="/companies" replace /> },
      { path: "companies", element: <CompanyRequestsPage /> },
      { path: "companies/:id", element: <CompanyRequestsPage /> },
      { path: "learning/certificates", element: <CertificatesPage /> },
      { path: "learning/qa", element: ph("أسئلة المتدربين", "Q&A inbox") },

      // Consultations (B2C)
      { path: "consultations", element: <ConsultationsOverviewPage /> },
      { path: "consultations/live", element: <LiveMeetingsPage /> },
      { path: "consultations/services", element: <Navigate to="/learning/consultations" replace /> },
      { path: "consultations/consultants", element: <Navigate to="/learning/consultants" replace /> },
      { path: "consultations/experts", element: <ConsultationExpertsPage /> },
      { path: "consultations/experts/:id", element: <ExpertDetailPage /> },
      { path: "consultations/bookings", element: <ConsultationBookingsPage /> },
      { path: "consultations/bookings/:id", element: <BookingDetailPage /> },
      { path: "consultations/orders", element: <ConsultationOrdersPage /> },

      // Subscriptions (B2C)
      { path: "subscriptions", element: <SubscriptionsOverviewPage /> },
      { path: "subscriptions/plans", element: <SubscriptionPlansPage /> },
      { path: "subscriptions/plans/new", element: <SubscriptionPlanNewPage /> },
      { path: "subscriptions/plans/:id", element: <SubscriptionPlanDetailPage /> },
      { path: "subscriptions/features", element: <SubscriptionFeaturesPage /> },
      { path: "subscriptions/subscribers", element: <SubscribersPage /> },
      { path: "subscriptions/subscribers/:id", element: <SubscriberDetailPage /> },
      { path: "subscriptions/team-leads", element: <TeamLeadsPage /> },
      { path: "subscriptions/team-leads/:id", element: <TeamLeadDetailPage /> },
      { path: "subscriptions/company-insights", element: <CompanyInsightsPage /> },
      { path: "companies/leads", element: <TeamLeadsPage /> },
      { path: "companies/leads/:id", element: <TeamLeadDetailPage /> },
      { path: "companies/insights", element: <CompanyInsightsPage /> },

      // Customers
      { path: "customers", element: <CustomersPage /> },
      { path: "customers/:id", element: <CustomerDetailPage /> },
      { path: "customers/accounts", element: <AccountsPage /> },
      { path: "customers/entitlements", element: <EntitlementsPage /> },
      { path: "customers/segments", element: <SegmentsPage /> },
      { path: "customers/tickets", element: <TicketsPage /> },
      { path: "customers/tickets/:ticketId", element: <TicketDetailPage /> },
      { path: "admin/support/b2c", element: <Navigate to="/customers/tickets" replace /> },
      { path: "admin/support/b2c/:ticketId", element: <Navigate to="/customers/tickets/:ticketId" replace /> },

      // Marketing
      { path: "marketing/affiliates", element: <PartnersPage /> },
      { path: "marketing/affiliates/new", element: <PartnerNewPage /> },
      { path: "marketing/affiliates/import", element: <AffiliateImportPage /> },
      { path: "marketing/affiliates/:partnerId", element: <PartnerDetailPage /> },
      { path: "marketing/commissions", element: <AffiliateCommissionsPage /> },
      { path: "marketing/commissions/legacy", element: <CommissionsPage /> },
      { path: "marketing/referral-program", element: <ReferralProgramPage /> },
      { path: "marketing/payouts", element: <PayoutsPage /> },
      { path: "marketing/announcements", element: <AnnouncementsPage /> },
      { path: "marketing/policies", element: <PoliciesPage /> },
      { path: "marketing/banners", element: <BannersPage /> },

      // Analytics
      { path: "analytics/sales", element: <AnalyticsSalesPage /> },
      { path: "analytics/products", element: <ProductsReportPage /> },
      { path: "analytics/coupons", element: <CouponsReportPage /> },
      { path: "analytics/customers", element: <CustomersReportPage /> },
      { path: "analytics/affiliates", element: <AffiliatesAnalyticsPage /> },
      { path: "analytics/affiliates/legacy", element: <AffiliatesReportPage /> },
      { path: "analytics/ratings", element: <RatingsPage /> },
      { path: "analytics/certificates", element: <CertificatesPage /> },
      { path: "analytics/behavior", element: <BehaviorOverviewPage /> },
      { path: "analytics/funnels", element: <FunnelsPage /> },
      { path: "analytics/behavior-map", element: <BehaviorMapPage /> },

      // Settings
      { path: "settings/general", element: <GeneralSettingsPage /> },
      { path: "settings/team", element: <TeamPage /> },
      { path: "settings/integrations", element: ph("التكاملات", "Integrations") },
      { path: "settings/notifications", element: <NotificationsPage /> },
      { path: "settings/audit", element: <AuditPage /> },

      // Unknown paths stay in the shell and say so, instead of silently bouncing to the dashboard.
      { path: "*", element: <NotFoundPage /> },
    ],
  },
]);

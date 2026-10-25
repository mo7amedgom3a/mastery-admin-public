import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  productKeys,
  productQueries,
  searchQueries,
  setProductStatus,
  curriculumQueries,
  type ProductStatus,
  type ProductType,
} from "@/lib/api";
import { productTypeLabel } from "@/lib/product-types";
import { ordersQueries } from "@/lib/api/sales/orders";
import { useT } from "@/lib/i18n";
import { Loading, ErrorAlert } from "@/components/ui/kit";
import { LegacyProductContent } from "@/features/learning/components/legacy-product-content";
import { DetailHeader } from "./components/detail-header";
import { DetailTabBar, type DetailTab, type DetailTabDef } from "./components/detail-tabbar";
import { DetailAside } from "./components/detail-aside";
import { OverviewTab } from "./tabs/overview-tab";
import { ProductDetailsEditor } from "./components/product-details-editor";
import { ContentTab } from "./tabs/content-tab";
import { ResourcesTab } from "./tabs/resources-tab";
import { InstructorsTab } from "./tabs/instructors-tab";
import { OrdersTab } from "./tabs/orders-tab";
import { RelatedTab } from "./tabs/related-tab";
import { LegacyTab } from "./tabs/legacy-tab";
import { BundleTab } from "./tabs/bundle-tab";
import { ConsultationTab } from "./tabs/consultation-tab";
import { LiveDiplomaTab } from "./tabs/live-diploma-tab";
import { PackageTab } from "./tabs/package-tab";
import { EntitlementDirectory } from "@/features/entitlements/components/entitlement-lists";
import { can } from "@/lib/permissions";

export function ProductDetailPage() {
  const t = useT();
  const { productId = "" } = useParams<{ productId: string }>();
  const productRef = decodeURIComponent(productId);
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Tab State
  const tabParam = searchParams.get("tab") as DetailTab | null;
  const [activeTab, setActiveTab] = useState<DetailTab>(tabParam || "overview");

  useEffect(() => {
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const handleSelectTab = (tab: DetailTab) => {
    setActiveTab(tab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      },
      { replace: true },
    );
  };

  // Queries
  const productQuery = useQuery(productQueries.detail(productRef));
  const productData = productQuery.data;
  const slug = productData?.b2c ? productData.product.slug : undefined;

  const searchDetailQuery = useQuery({
    ...searchQueries.productDetails(slug ?? ""),
    enabled: Boolean(slug),
  });

  const unitsQuery = useQuery(curriculumQueries.units(productRef));
  const units = useMemo(() => unitsQuery.data ?? [], [unitsQuery.data]);

  // A package's curriculum is the B2C courses it bundles, so its header/overview read those.
  const isPackageProduct = productData?.product?.product_type === "package" && Boolean(productData?.b2c);
  const packageCoursesQuery = useQuery({
    ...productQueries.courses(productRef),
    enabled: isPackageProduct,
  });
  const packageCourses = useMemo(() => packageCoursesQuery.data ?? [], [packageCoursesQuery.data]);

  const salesQuery = useQuery(productQueries.sales(productRef, { bucket: "month" }));
  const salesData = salesQuery.data;

  // Query orders count for tab badge
  const ordersCountQuery = useQuery(
    ordersQueries.list({
      product_ref: productRef,
      limit: 1,
    }),
  );
  const totalOrdersCount = ordersCountQuery.data?.total ?? salesData?.total_orders ?? 0;

  // Publish / Unpublish modal & mutation
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const setStatus = useMutation({
    mutationFn: (status: ProductStatus) => setProductStatus(productRef, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.detail(productRef) });
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      setPublishModalOpen(false);
    },
  });

  const item = productData?.product;
  const productType = (item?.product_type ?? "course") as ProductType;
  const legacyKind =
    productData?.links.legacy_kind === "package"
      ? "package"
      : productData?.links.legacy_kind === "course"
        ? "course"
        : null;
  const hasLegacy = Boolean(legacyKind && !productData?.b2c);

  const searchDetail = searchDetailQuery.data;
  const searchObj = useMemo(() => searchDetail as Record<string, unknown> | undefined, [searchDetail]);

  const isB2c = Boolean(productData?.b2c);
  const tabs: DetailTabDef[] = useMemo(() => {
    const overview: DetailTabDef = { id: "overview", labelAr: "نظرة عامة", labelEn: "Overview" };
    const orders: DetailTabDef = {
      id: "orders",
      labelAr: "الطلبات والمبيعات",
      labelEn: "Orders & Sales",
      count: totalOrdersCount,
    };
    const related: DetailTabDef = {
      id: "related",
      labelAr: "ذات صلة",
      labelEn: "Related",
      count:
        (searchDetail?.related?.courses?.length || 0) +
        (searchDetail?.related?.diplomas?.length || 0) +
        (searchDetail?.related?.packages?.length || 0) +
        (searchDetail?.related?.consultations?.length || 0),
    };
    // Who holds this product (B2C products only): extend, suspend, reinstate or revoke each customer's access.
    const access: DetailTabDef[] =
      isB2c && can("subscribers.read") ? [{ id: "access", labelAr: "وصول العملاء", labelEn: "Customer access" }] : [];
    const legacy: DetailTabDef | null = hasLegacy
      ? { id: "legacy", labelAr: "محتوى النظام القديم", labelEn: "Legacy content" }
      : null;

    switch (productType) {
      case "package":
        return [overview, { id: "package", labelAr: "الحزمة", labelEn: "Package" }, orders, ...access, related];
      case "bundle":
        return [overview, { id: "bundle", labelAr: "باقة الدورات", labelEn: "Bundle contents" }, orders, ...access, related];
      case "consultation":
        return [overview, { id: "consultation", labelAr: "الاستشارة", labelEn: "Consultation" }, orders, ...access, related];
      case "live_diploma":
        return [overview, { id: "live_diploma", labelAr: "الدبلوم المباشر", labelEn: "Live diploma" }, orders, ...access, related];
      default: {
        const content: DetailTabDef = {
          id: "content",
          labelAr: "محتوى الدورة",
          labelEn: "Course content",
          count: units.reduce((acc, u) => acc + (u.lessons?.length || 0), 0),
        };
        const instructors: DetailTabDef = {
          id: "instructors",
          labelAr: "المدربون",
          labelEn: "Instructors",
          count: Array.isArray(searchObj?.instructors)
            ? searchObj.instructors.length
            : Array.isArray(searchObj?.trainers)
              ? searchObj.trainers.length
              : 1,
        };
        return [
          overview,
          content,
          { id: "resources", labelAr: "المصادر والمحتوى", labelEn: "Resources" },
          instructors,
          orders,
          ...access,
          related,
          ...(legacy ? [legacy] : []),
        ];
      }
    }
  }, [productType, hasLegacy, isB2c, units, totalOrdersCount, searchDetail, searchObj]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.id === activeTab)) {
      setActiveTab("overview");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabs]);

  if (productQuery.isLoading) {
    return (
      <div style={{ padding: 48 }}>
        <Loading />
      </div>
    );
  }

  if (productQuery.error || !productData || !item) {
    return (
      <div style={{ padding: 24 }}>
        <ErrorAlert error={productQuery.error || new Error(t("المنتج غير موجود", "Product not found"))} />
      </div>
    );
  }

  const isPublished = item.status === "published";
  const showAside = activeTab !== "legacy";

  return (
    <div className="cd-main" style={{ minHeight: "100vh" }}>
      {/* Header & 5-KPI Strip */}
      <DetailHeader
        productRef={productRef}
        data={productData}
        units={units}
        packageCourses={packageCourses}
        sales={salesData}
        onTogglePublish={() => setPublishModalOpen(true)}
      />

      {/* Sticky Tab Bar */}
      <DetailTabBar
        activeTab={activeTab}
        tabs={tabs}
        onSelectTab={handleSelectTab}
        productTitle={item.title ?? undefined}
        isPublished={isPublished}
        onTogglePublish={() => setPublishModalOpen(true)}
      />

      {/* Body with Tabs and Aside */}
      <div className={`cd-body ${showAside ? "" : "cd-body--wide"}`}>
        <div className="cd-page" role="tabpanel">
          {activeTab === "overview" && (
            <OverviewTab
              productRef={productRef}
              data={productData}
              searchDetail={searchDetail}
              units={units}
              packageCourses={packageCourses}
              onGoToContent={() => handleSelectTab(productType === "package" ? "package" : "content")}
            />
          )}

          {activeTab === "overview" &&
            productData.b2c &&
            (productType === "course" || productType === "diploma" || productType === "package") && (
              <ProductDetailsEditor key={productRef} productRef={productRef} data={productData} />
            )}

          {activeTab === "content" && <ContentTab productRef={productRef} />}

          {activeTab === "resources" && (
            <ResourcesTab productRef={productRef} data={productData} searchDetail={searchDetail} />
          )}

          {activeTab === "instructors" && (
            <InstructorsTab productRef={productRef} data={productData} searchDetail={searchDetail} />
          )}

          {activeTab === "package" &&
            (productData.b2c ? (
              <PackageTab productRef={productRef} />
            ) : (
              // Legacy-only package (no B2C product yet): read-only legacy content.
              <LegacyProductContent productRef={productRef} kind="package" />
            ))}

          {activeTab === "bundle" && (
            <BundleTab productRef={productRef} productId={item.product_id ?? null} />
          )}

          {activeTab === "consultation" && <ConsultationTab data={productData} productRef={productRef} />}

          {activeTab === "live_diploma" && <LiveDiplomaTab slug={item.slug} />}

          {activeTab === "orders" && <OrdersTab productRef={productRef} />}

          {activeTab === "access" && item?.product_id ? <EntitlementDirectory productId={item.product_id} /> : null}

          {activeTab === "related" && <RelatedTab productRef={productRef} detail={searchDetail} />}

          {activeTab === "legacy" && legacyKind && <LegacyTab productRef={productRef} legacyKind={legacyKind} />}
        </div>

        {/* Aside Facts & Completeness */}
        {showAside && <DetailAside data={productData} searchDetail={searchDetail} units={units} />}
      </div>

      {/* Publish / Unpublish Confirmation Modal */}
      {publishModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setPublishModalOpen(false);
          }}
        >
          <div className="cd-card" style={{ width: "min(460px, 92vw)", padding: 24, boxShadow: "var(--sh-xl)" }}>
            <h2 className="cd-modal__h">
              {isPublished
                ? t("إلغاء نشر المنتج؟", "Unpublish product?")
                : t("نشر المنتج على المنصة؟", "Publish product to platform?")}
            </h2>
            <p className="cd-muted" style={{ marginBlock: "12px 24px", lineHeight: 1.6 }}>
              {isPublished
                ? t(
                    "لن يعود هذا المنتج متاحاً للشراء في الكتالوج العام للطلاب حتى تتم إعادة نشره مجدداً.",
                    "This product will no longer be visible or purchasable in the public student catalog until republished.",
                  )
                : t(
                    "سيصبح هذا المنتج متاحاً للشراء والعرض في الكتالوج العام لجميع الطلاب. النوع: ",
                    "This product will become publicly visible and purchasable in the catalog for all students. Type: ",
                  )}
              {!isPublished
                ? (() => {
                    const label = productTypeLabel(productType);
                    return t(label.ar, label.en);
                  })()
                : null}
            </p>
            <div className="cd-modal__f" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="ma-btn ma-btn--soft" onClick={() => setPublishModalOpen(false)}>
                {t("إلغاء", "Cancel")}
              </button>
              <button
                type="button"
                className={`ma-btn ${isPublished ? "ma-btn--danger-soft" : "ma-btn--primary"}`}
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate(isPublished ? "draft" : "published")}
              >
                {setStatus.isPending
                  ? t("جاري التحديث...", "Updating...")
                  : isPublished
                    ? t("تأكيد إلغاء النشر", "Confirm unpublish")
                    : t("تأكيد النشر", "Confirm publish")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default ProductDetailPage;

import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/*
 * One catalog over B2C and the legacy platform (`/admin/catalog`). Products are addressed by ref:
 * `b2c:<product_id>` for B2C products, `legacy:course:<id>` / `legacy:package:<id>` for legacy courses and
 * packages that no B2C product represents yet. The legacy content of a product (curriculum, price rows,
 * rules, certificates, ratings, instructors, learners) is read with any of its refs.
 */

type ListProductsOp = "list_products_api_v1_admin_catalog_products_get";
type GetProductOp = "get_product_api_v1_admin_catalog_products__product_ref__get";
type SetStatusOp = "set_product_status_api_v1_admin_catalog_products__product_ref__status_post";
type SalesOp = "product_sales_api_v1_admin_catalog_products__product_ref__sales_get";
type BehaviorOp = "product_behavior_api_v1_admin_catalog_products__product_ref__behavior_get";
type TransactionsOp = "product_transactions_api_v1_admin_catalog_products__product_ref__transactions_get";
type FacetsOp = "product_facets_api_v1_admin_catalog_products_facets_get";
type InsightsOp = "product_insights_api_v1_admin_catalog_products_insights_get";
type CurriculumOp = "product_curriculum_api_v1_admin_catalog_products__product_ref__curriculum_get";
type PricesOp = "product_prices_api_v1_admin_catalog_products__product_ref__prices_get";
type RulesOp = "product_rules_api_v1_admin_catalog_products__product_ref__rules_get";
type CertificatesOp = "product_certificates_api_v1_admin_catalog_products__product_ref__certificates_get";
type RatingsOp = "product_ratings_api_v1_admin_catalog_products__product_ref__ratings_get";
type InstructorsOp = "product_instructors_api_v1_admin_catalog_products__product_ref__instructors_get";
type LearnersOp = "product_learners_api_v1_admin_catalog_products__product_ref__learners_get";
type SummaryOp = "package_summary_api_v1_admin_catalog_products__product_ref__summary_get";
type PackageCoursesOp = "package_courses_api_v1_admin_catalog_products__product_ref__courses_get";
type UpdatePackageOp = "update_package_api_v1_admin_catalog_products__product_ref__package_put";
type PackageSectionsGetOp = "package_detail_sections_api_v1_admin_catalog_products__product_ref__package_sections_get";
type UpdatePackageSectionsOp = "update_package_sections_api_v1_admin_catalog_products__product_ref__package_sections_put";
type AddPackageCourseOp = "add_package_course_api_v1_admin_catalog_products__product_ref__package_courses_post";
type UpdatePackageCourseOp = "update_package_course_api_v1_admin_catalog_products__product_ref__package_courses__member_product_id__patch";
type UpdateProductOp = "update_product_api_v1_admin_catalog_products__product_ref__patch";
type ListProductResourcesOp = "list_product_resources_api_v1_admin_catalog_products__product_ref__resources_get";
type UpdateResourceDurationOp = "update_resource_duration_api_v1_admin_catalog_resources__resource_id__patch";
type CategorySuggestionsOp = "category_suggestions_api_v1_admin_catalog_categories__category_id__suggestions_get";
type CategoriesOp = "list_categories_api_v1_admin_catalog_categories_get";
type PriceListsOp = "list_price_lists_api_v1_admin_catalog_price_lists_get";
type ExtensionPackagesOp = "list_extension_packages_api_v1_admin_catalog_extension_packages_get";
type CertificateTemplatesOp = "list_certificate_templates_api_v1_admin_catalog_certificates_get";
type AllRatingsOp = "list_ratings_api_v1_admin_catalog_ratings_get";

export type ProductsParams = QueryParams<ListProductsOp>;
export type ProductPage = SuccessResponse<ListProductsOp>;
export type ProductSalesParams = QueryParams<SalesOp>;
export type ProductSalesSeries = SuccessResponse<SalesOp>;
export type ProductSalesPoint = NonNullable<ProductSalesSeries["points"]>[number];
export type ProductBehaviorParams = QueryParams<BehaviorOp>;
export type ProductBehaviorStats = SuccessResponse<BehaviorOp>;
export type ProductBehaviorPoint = NonNullable<ProductBehaviorStats["points"]>[number];
export type ProductTransactionsParams = QueryParams<TransactionsOp>;
export type ProductTransactions = SuccessResponse<TransactionsOp>;
export type ProductTransactionPoint = NonNullable<ProductTransactions["points"]>[number];
export type ProductTransactionRow = NonNullable<ProductTransactions["items"]>[number];
/** A catalog list item; `source` is `b2c` or `legacy`, `ref` addresses it. */
export type Product = ProductPage["items"][number];
/** `GET /admin/catalog/products/{ref}`: list item, B2C detail (`b2c`), legacy detail (`legacy`) and `links`. */
export type ProductView = SuccessResponse<GetProductOp>;
export type ProductDetail = NonNullable<ProductView["b2c"]>;
export type LegacyProductDetail = NonNullable<ProductView["legacy"]>;
export type ProductLinks = ProductView["links"];
export type ProductItem = ProductView["product"];
export type ProductPrice = ProductDetail["prices"][number];
export type ProductStatus = RequestBody<SetStatusOp>["status"];
export type ProductSort = NonNullable<ProductsParams["sort"]>;
export type ProductSource = NonNullable<ProductsParams["source"]>;
export type ProductOrigin = NonNullable<ProductsParams["origin"]>;

/** Product types an admin can create. */
export type ProductCreateType = "course" | "diploma" | "package" | "consultation";

export type ProductLevel = "beginner" | "intermediate" | "advanced";

/** Fields accepted when creating a catalog product (course/diploma/package/consultation). */
export interface CreateProductRequest {
  product_type?: ProductCreateType;
  title: string;
  title_en?: string | null;
  description?: string | null;
  price?: number | null;
  /** ISO 4217; the backend defaults to USD. */
  currency_code?: string;
  short_description?: string | null;
  duration_hours?: number | null;
  level?: ProductLevel | null;
  language?: string | null;
  /** Entitlement length in days after purchase; null/omitted = lifetime. */
  access_duration_days?: number | null;
  cpd_eligible?: boolean;
  /** Consultation session length. */
  duration_minutes?: number | null;
  slug?: string | null;
  published?: boolean;
  category_ids?: string[];
  keywords?: string[];
  marketing_tag?: string | null;
  skill_ids?: string[];
  featured?: boolean;
  manual_accounting?: boolean;
  apple_store_id?: string | null;
  google_store_id?: string | null;
  instructor_ids?: number[];
  expert_ids?: number[];
  course_refs?: string[];
}

/** A skill option from `GET /catalog/onboarding-options`. */
export interface ProductSkillOption {
  skill_id: string;
  slug: string;
  name: string;
}

/** A tag option with its product count, from `GET /catalog/onboarding-options`. */
export interface ProductTagOption {
  tag: string;
  count: number;
}

export type UpdateProductRequest = RequestBody<UpdateProductOp>;
/** Skills and tags curated for one category. */
export type CategorySuggestions = SuccessResponse<CategorySuggestionsOp>;

/** A product resource with its B2C-owned duration (`duration_minutes`). */
export type ProductResourceDuration = SuccessResponse<ListProductResourcesOp>[number];
export type UpdateResourceDurationRequest = RequestBody<UpdateResourceDurationOp>;

/** `PATCH /admin/catalog/products/{ref}` — partial update of details, general info, categories, skills. */
export function updateProduct(
  product_ref: PathParams<GetProductOp>["product_ref"],
  body: UpdateProductRequest,
): Promise<ProductView> {
  return apiPatch(productPaths.detail, { path: { product_ref }, body });
}

/** `GET /admin/catalog/products/{ref}/resources` — the product's resources with their durations. */
export function listProductResources(
  product_ref: PathParams<GetProductOp>["product_ref"],
): Promise<ProductResourceDuration[]> {
  return apiGet(productPaths.resources, { path: { product_ref } });
}

/** `PATCH /admin/catalog/resources/{id}` — set a resource's B2C-owned duration (minutes). */
export function updateResourceDuration(
  resource_id: string,
  body: UpdateResourceDurationRequest,
): Promise<ProductResourceDuration> {
  return apiPatch(resourcePaths.detail, { path: { resource_id }, body });
}

/** `GET /admin/catalog/categories/{id}/suggestions` — the skills/tags that go with a category. */
export function getCategorySuggestions(category_id: string): Promise<CategorySuggestions> {
  return apiGet(categorySuggestionsPath, { path: { category_id } });
}

/** `GET /catalog/onboarding-options` — skills, tags and product types for the product form. */
export interface OnboardingOptions {
  skills: ProductSkillOption[];
  tags: ProductTagOption[];
  product_types: { code: string; name: string; count: number }[];
}

/** A B2C category from `GET /catalog/categories`. */
export interface CatalogCategoryOption {
  category_id: string;
  slug: string;
  name: string | null;
  parent_id: string | null;
  sort_order: number;
  product_count: number;
}

/** A slim published product card from `GET /catalog/cards`. */
export interface CatalogProductCard {
  product_id: string;
  slug: string;
  product_type: string;
  title: string | null;
}

/** Query params of `GET /catalog/cards` (product_type is repeatable). */
export type CatalogCardsParams = {
  product_type?: string[];
  slug?: string[];
  expert?: string;
  category_id?: string;
  sort?: "newest" | "title";
  limit?: number;
  offset?: number;
};

export type ProductFacets = SuccessResponse<FacetsOp>;
export type ProductInsightsParams = QueryParams<InsightsOp>;
export type ProductInsights = SuccessResponse<InsightsOp>;
export type ProductInsightItem = ProductInsights["top_sellers"][number];
export type ProductInsightSegment = ProductInsights["segments_by_product"][number];

export type ContentSection = SuccessResponse<CurriculumOp>[number];
export type LegacyPriceRow = SuccessResponse<PricesOp>[number];
export type CompletionRule = SuccessResponse<RulesOp>[number];
export type ProductCertificate = SuccessResponse<CertificatesOp>[number];
export type ProductRatingPage = SuccessResponse<RatingsOp>;
export type ProductRating = ProductRatingPage["items"][number];
export type ProductInstructor = SuccessResponse<InstructorsOp>[number];
export type ProductLearners = SuccessResponse<LearnersOp>;
export type PackageSummary = SuccessResponse<SummaryOp>;
export type PackageCourse = SuccessResponse<PackageCoursesOp>[number];
export type UpdatePackageBody = RequestBody<UpdatePackageOp>;
export type AddPackageCourseBody = RequestBody<AddPackageCourseOp>;
export type UpdatePackageCourseBody = RequestBody<UpdatePackageCourseOp>;
export type PackageDetailSection = SuccessResponse<PackageSectionsGetOp>[number];
export type UpdatePackageSectionsBody = RequestBody<UpdatePackageSectionsOp>;

export type CategoriesParams = QueryParams<CategoriesOp>;
export type ProductCategoryPage = SuccessResponse<CategoriesOp>;
export type PriceListsParams = QueryParams<PriceListsOp>;
export type PriceListPage = SuccessResponse<PriceListsOp>;
export type ExtensionPackagesParams = QueryParams<ExtensionPackagesOp>;
export type ExtensionPackagePage = SuccessResponse<ExtensionPackagesOp>;
export type CertificateTemplatesParams = QueryParams<CertificateTemplatesOp>;
export type CertificateTemplatePage = SuccessResponse<CertificateTemplatesOp>;
export type RatingsParams = QueryParams<AllRatingsOp>;

export const productPaths = {
  list: "admin/catalog/products",
  detail: "admin/catalog/products/{product_ref}",
  status: "admin/catalog/products/{product_ref}/status",
  sales: "admin/catalog/products/{product_ref}/sales",
  behavior: "admin/catalog/products/{product_ref}/behavior",
  transactions: "admin/catalog/products/{product_ref}/transactions",
  facets: "admin/catalog/products/facets",
  insights: "admin/catalog/products/insights",
  curriculum: "admin/catalog/products/{product_ref}/curriculum",
  prices: "admin/catalog/products/{product_ref}/prices",
  rules: "admin/catalog/products/{product_ref}/rules",
  certificates: "admin/catalog/products/{product_ref}/certificates",
  ratings: "admin/catalog/products/{product_ref}/ratings",
  instructors: "admin/catalog/products/{product_ref}/instructors",
  learners: "admin/catalog/products/{product_ref}/learners",
  summary: "admin/catalog/products/{product_ref}/summary",
  resources: "admin/catalog/products/{product_ref}/resources",
  courses: "admin/catalog/products/{product_ref}/courses",
  package: "admin/catalog/products/{product_ref}/package",
  packageSections: "admin/catalog/products/{product_ref}/package/sections",
  packageCourses: "admin/catalog/products/{product_ref}/package/courses",
  packageCourse: "admin/catalog/products/{product_ref}/package/courses/{member_product_id}",
  categories: "admin/catalog/categories",
  priceLists: "admin/catalog/price-lists",
  extensionPackages: "admin/catalog/extension-packages",
  certificateTemplates: "admin/catalog/certificates",
  allRatings: "admin/catalog/ratings",
} as const;

/** B2C resources of a product (`/admin/catalog/resources`). */
export const resourcePaths = {
  detail: "admin/catalog/resources/{resource_id}",
} as const;

/** Public catalog read endpoints (`/catalog/*`) used by the product form for its options. */
export const categorySuggestionsPath = "admin/catalog/categories/{category_id}/suggestions";

export const catalogPaths = {
  onboardingOptions: "catalog/onboarding-options",
  categories: "catalog/categories",
  cards: "catalog/cards",
} as const;

export const productKeys = {
  all: ["learning", "products"] as const,
  list: (params?: ProductsParams) => [...productKeys.all, "list", params ?? {}] as const,
  detail: (productRef: string) => [...productKeys.all, "detail", productRef] as const,
  content: (productRef: string, part: string) => [...productKeys.all, "content", productRef, part] as const,
  sales: (productRef: string, params?: ProductSalesParams) =>
    [...productKeys.all, "sales", productRef, params ?? {}] as const,
  behavior: (productRef: string, params?: ProductBehaviorParams) =>
    [...productKeys.all, "behavior", productRef, params ?? {}] as const,
  transactions: (productRef: string, params?: ProductTransactionsParams) =>
    [...productKeys.all, "transactions", productRef, params ?? {}] as const,
  facets: (productType?: string) => [...productKeys.all, "facets", productType ?? ""] as const,
  insights: (params: ProductInsightsParams) => [...productKeys.all, "insights", params] as const,
  lists: (name: string, params?: object) => [...productKeys.all, name, params ?? {}] as const,
};

/** Product ref of a legacy course/package. */
export function legacyProductRef(kind: "course" | "package", legacyId: number | string): string {
  return `legacy:${kind}:${legacyId}`;
}

/** `GET /admin/catalog/products` — B2C products and not-migrated legacy courses/packages (`source` filters). */
export function listProducts(params: ProductsParams = {}): Promise<ProductPage> {
  return apiGet(productPaths.list, { query: params });
}

export function getProduct(product_ref: PathParams<GetProductOp>["product_ref"]): Promise<ProductView> {
  return apiGet(productPaths.detail, { path: { product_ref } });
}

/** `POST /admin/catalog/products` — creates a course, diploma, package or consultation. Audited. */
export function createProduct(body: CreateProductRequest): Promise<ProductView> {
  return apiPost(productPaths.list, { body });
}

/** `GET /catalog/onboarding-options` — skills, tags and product types for the product form. */
export function getOnboardingOptions(): Promise<OnboardingOptions> {
  return apiGet(catalogPaths.onboardingOptions);
}

/** `GET /catalog/categories` — B2C categories (with ids) for assigning to a product. */
export function listCatalogCategories(): Promise<CatalogCategoryOption[]> {
  return apiGet(catalogPaths.categories);
}

/** `GET /catalog/cards` — slim published product cards (package member picker). */
export function listCatalogCards(
  params: CatalogCardsParams = {},
): Promise<{ items: CatalogProductCard[]; total: number }> {
  return apiGet(catalogPaths.cards, { query: params });
}

/** `POST /admin/catalog/products/{ref}/status` — B2C status, or publish/draft a legacy-only product. Audited. */
export function setProductStatus(
  product_ref: PathParams<SetStatusOp>["product_ref"],
  status: ProductStatus,
): Promise<ProductView> {
  return apiPost(productPaths.status, { path: { product_ref }, body: { status } });
}

/** `GET /admin/catalog/products/facets` — categories, top tags, product types and sources with counts. */
export function getProductFacets(product_type?: string): Promise<ProductFacets> {
  return apiGet(productPaths.facets, { query: { product_type } });
}

/** `GET /admin/catalog/products/insights` — best sellers, most viewed, low rated, never sold, pie series. */
export function getProductInsights(params: ProductInsightsParams): Promise<ProductInsights> {
  return apiGet(productPaths.insights, { query: params });
}

function content<T>(path: string, product_ref: string, query?: Record<string, unknown>): Promise<T> {
  return apiGet(path, { path: { product_ref }, query: query as never });
}

export const getProductCurriculum = (ref: string) => content<ContentSection[]>(productPaths.curriculum, ref);
export const getProductPrices = (ref: string) => content<LegacyPriceRow[]>(productPaths.prices, ref);
export const getProductSales = (ref: string, query?: ProductSalesParams) =>
  content<ProductSalesSeries>(productPaths.sales, ref, query as never);
export const getProductBehavior = (ref: string, query?: ProductBehaviorParams) =>
  content<ProductBehaviorStats>(productPaths.behavior, ref, query as never);
export const getProductTransactions = (ref: string, query?: ProductTransactionsParams) =>
  content<ProductTransactions>(productPaths.transactions, ref, query as never);
export const getProductRules = (ref: string) => content<CompletionRule[]>(productPaths.rules, ref);
export const getProductCertificates = (ref: string) => content<ProductCertificate[]>(productPaths.certificates, ref);
export const getProductRatings = (ref: string, query?: { limit?: number; offset?: number }) =>
  content<ProductRatingPage>(productPaths.ratings, ref, query);
export const getProductInstructors = (ref: string) => content<ProductInstructor[]>(productPaths.instructors, ref);
export const getProductLearners = (ref: string, limit = 200) =>
  content<ProductLearners>(productPaths.learners, ref, { limit });
export const getPackageSummary = (ref: string) => content<PackageSummary>(productPaths.summary, ref);export const getPackageCourses = (ref: string) => content<PackageCourse[]>(productPaths.courses, ref);
/** Order the package's detail sections (المقدمة، المحاور، الأهداف، الفئة المستهدفة) — B2C. */
export const getPackageSections = (ref: string) => content<PackageDetailSection[]>(productPaths.packageSections, ref);
/** Replaces the package's detail sections. */
export const updatePackageSections = (product_ref: string, body: UpdatePackageSectionsBody) =>
  apiPut(productPaths.packageSections, { path: { product_ref }, body });

/** Renames / describes / publishes a B2C package. */
export const updatePackage = (product_ref: string, body: UpdatePackageBody) =>
  apiPut(productPaths.package, { path: { product_ref }, body });
/** Bundles a B2C product into a package. */
export const addPackageCourse = (product_ref: string, body: AddPackageCourseBody) =>
  apiPost(productPaths.packageCourses, { path: { product_ref }, body });
/** Marks a bundled course required or optional. */
export const updatePackageCourse = (product_ref: string, member_product_id: string, body: UpdatePackageCourseBody) =>
  apiPatch(productPaths.packageCourse, { path: { product_ref, member_product_id }, body });
/** Unbundles a course from a package. */
export const removePackageCourse = (product_ref: string, member_product_id: string) =>
  apiDelete(productPaths.packageCourse, { path: { product_ref, member_product_id } });

export function listCategories(params: CategoriesParams = {}): Promise<ProductCategoryPage> {
  return apiGet(productPaths.categories, { query: params });
}

export function listPriceLists(params: PriceListsParams = {}): Promise<PriceListPage> {
  return apiGet(productPaths.priceLists, { query: params });
}

export function listExtensionPackages(params: ExtensionPackagesParams = {}): Promise<ExtensionPackagePage> {
  return apiGet(productPaths.extensionPackages, { query: params });
}

export function listCertificateTemplates(params: CertificateTemplatesParams = {}): Promise<CertificateTemplatePage> {
  return apiGet(productPaths.certificateTemplates, { query: params });
}

export function listRatings(params: RatingsParams = {}): Promise<ProductRatingPage> {
  return apiGet(productPaths.allRatings, { query: params });
}

export const productQueries = {
  list: (params?: ProductsParams) => queryOptions({ queryKey: productKeys.list(params), queryFn: () => listProducts(params) }),
  detail: (productRef: string) =>
    queryOptions({ queryKey: productKeys.detail(productRef), queryFn: () => getProduct(productRef) }),
  sales: (productRef: string, params?: ProductSalesParams) =>
    queryOptions({ queryKey: productKeys.sales(productRef, params), queryFn: () => getProductSales(productRef, params) }),
  behavior: (productRef: string, params?: ProductBehaviorParams) =>
    queryOptions({ queryKey: productKeys.behavior(productRef, params), queryFn: () => getProductBehavior(productRef, params) }),
  transactions: (productRef: string, params?: ProductTransactionsParams) =>
    queryOptions({ queryKey: productKeys.transactions(productRef, params), queryFn: () => getProductTransactions(productRef, params) }),
  facets: (productType?: string) =>
    queryOptions({ queryKey: productKeys.facets(productType), queryFn: () => getProductFacets(productType), staleTime: 5 * 60_000 }),
  insights: (params: ProductInsightsParams) =>
    queryOptions({ queryKey: productKeys.insights(params), queryFn: () => getProductInsights(params) }),
  curriculum: (ref: string) =>
    queryOptions({ queryKey: productKeys.content(ref, "curriculum"), queryFn: () => getProductCurriculum(ref) }),
  prices: (ref: string) => queryOptions({ queryKey: productKeys.content(ref, "prices"), queryFn: () => getProductPrices(ref) }),
  rules: (ref: string) => queryOptions({ queryKey: productKeys.content(ref, "rules"), queryFn: () => getProductRules(ref) }),
  certificates: (ref: string) =>
    queryOptions({ queryKey: productKeys.content(ref, "certificates"), queryFn: () => getProductCertificates(ref) }),
  ratings: (ref: string) => queryOptions({ queryKey: productKeys.content(ref, "ratings"), queryFn: () => getProductRatings(ref) }),
  instructors: (ref: string) =>
    queryOptions({ queryKey: productKeys.content(ref, "instructors"), queryFn: () => getProductInstructors(ref) }),
  learners: (ref: string) => queryOptions({ queryKey: productKeys.content(ref, "learners"), queryFn: () => getProductLearners(ref) }),
  summary: (ref: string) => queryOptions({ queryKey: productKeys.content(ref, "summary"), queryFn: () => getPackageSummary(ref) }),
  packageSections: (ref: string) =>
    queryOptions({ queryKey: productKeys.content(ref, "package-sections"), queryFn: () => getPackageSections(ref) }),
  courses: (ref: string) => queryOptions({ queryKey: productKeys.content(ref, "courses"), queryFn: () => getPackageCourses(ref) }),
  categories: (params?: CategoriesParams) =>
    queryOptions({ queryKey: productKeys.lists("categories", params), queryFn: () => listCategories(params) }),
  priceLists: (params?: PriceListsParams) =>
    queryOptions({ queryKey: productKeys.lists("price-lists", params), queryFn: () => listPriceLists(params) }),
  extensionPackages: (params?: ExtensionPackagesParams) =>
    queryOptions({ queryKey: productKeys.lists("extension-packages", params), queryFn: () => listExtensionPackages(params) }),
  certificateTemplates: (params?: CertificateTemplatesParams) =>
    queryOptions({ queryKey: productKeys.lists("certificates", params), queryFn: () => listCertificateTemplates(params) }),
  allRatings: (params?: RatingsParams) =>
    queryOptions({ queryKey: productKeys.lists("ratings", params), queryFn: () => listRatings(params) }),
};

/** React Query options for the public catalog read endpoints used by the product form. */
export const catalogQueries = {
  onboardingOptions: () =>
    queryOptions({ queryKey: ["catalog", "onboarding-options"], queryFn: () => getOnboardingOptions() }),
  categories: () =>
    queryOptions({ queryKey: ["catalog", "categories"], queryFn: () => listCatalogCategories() }),
  cards: (params?: CatalogCardsParams) =>
    queryOptions({ queryKey: ["catalog", "cards", params ?? {}], queryFn: () => listCatalogCards(params) }),
  categorySuggestions: (categoryId: string) =>
    queryOptions({
      queryKey: ["catalog", "category-suggestions", categoryId],
      queryFn: () => getCategorySuggestions(categoryId),
      staleTime: 5 * 60_000,
    }),
};

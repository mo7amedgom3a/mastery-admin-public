import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listProductResources,
  studioQueries,
  updateResourceDuration,
  type ProductView,
  type SearchProductDetail,
} from "@/lib/api";
import { getProductResourceRefundComparisons } from "@/lib/api/sales/refund-cases";
import { useT } from "@/lib/i18n";
import { studioHref } from "@/lib/refs";
import { AppLink } from "@/components/ui/app-link";
import { RichHtml } from "@/components/ui/rich-html";
import { formatNumber } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import { cleanHtmlText } from "../model";

interface ResourcesTabProps {
  productRef: string;
  data: ProductView;
  searchDetail?: SearchProductDetail | null;
}

export function ResourcesTab({ productRef, data, searchDetail }: ResourcesTabProps) {
  const t = useT();
  const [descDismissed, setDescDismissed] = useState(false);

  const assetsQuery = useQuery(studioQueries.assets(productRef));
  const assets = assetsQuery.data?.items ?? [];
  const b2cId = productRef.startsWith("b2c:") ? productRef.slice(4) : data.b2c ? data.product.ref?.replace(/^b2c:/, "") ?? "" : "";
  const refundComparison = useQuery({
    queryKey: ["resource-refund-comparison", b2cId],
    queryFn: () => getProductResourceRefundComparisons(b2cId),
    enabled: Boolean(b2cId),
  });

  // B2C-owned resource durations — the source of truth for the search duration filter/sort.
  const queryClient = useQueryClient();
  const resourcesQuery = useQuery({
    queryKey: ["product-resource-durations", productRef],
    queryFn: () => listProductResources(productRef),
  });
  const resources = resourcesQuery.data ?? [];
  const [durationDraft, setDurationDraft] = useState<Record<string, string>>({});
  const saveDuration = useMutation({
    mutationFn: ({ resourceId, value }: { resourceId: string; value: string }) =>
      updateResourceDuration(resourceId, {
        duration_minutes: value.trim() === "" ? null : Number(value),
      }),
    onSuccess: (updated) => {
      setDurationDraft((prev) => {
        const next = { ...prev };
        delete next[updated.resource_id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["product-resource-durations", productRef] });
      toast.success(t("تم تحديث مدة المورد", "Resource duration updated"));
    },
    onError: () => toast.error(t("تعذّر تحديث مدة المورد", "Couldn't update the resource duration")),
  });

  const item = data.product;
  const rawDesc =
    data.legacy?.description ||
    (searchDetail as { description?: string })?.description ||
    data.b2c?.short_description ||
    "";
  const cleanedDesc = cleanHtmlText(rawDesc);
  const hasRawHtml = Boolean(rawDesc && rawDesc !== cleanedDesc && /<[a-z][\s\S]*>/i.test(rawDesc));

  const mediaItems: Array<{ kind: string; name: string; url?: string | null; meta?: string }> = [];
  if (item.image) {
    mediaItems.push({ kind: "cover", name: t("غلاف الدورة الأساسي", "Main cover image"), url: item.image, meta: "Banner" });
  }
  const detailObj = searchDetail as Record<string, unknown> | undefined;
  if (detailObj?.square_image || detailObj?.squareImage) {
    mediaItems.push({
      kind: "square",
      name: t("الصورة المربعة", "Square cover"),
      url: (detailObj.square_image ?? detailObj.squareImage) as string,
      meta: "1:1",
    });
  }

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="cd-bento">
      {data.b2c ? <section className="cd-card cd-s12">
        <div className="cd-card__h"><h2><Icon name="chart" />{t("المشتريات والاستردادات حسب المورد", "Purchases and refunds by resource")}</h2></div>
        <div className="cd-card__b">
          {refundComparison.isLoading ? <p>{t("جارٍ التحميل…", "Loading…")}</p> : null}
          {refundComparison.isError ? <p role="alert">{t("تعذّر تحميل المقارنة.", "Could not load comparison.")}</p> : null}
          {refundComparison.data?.length ? <div style={{ display: "grid", gap: 14 }}>
            {refundComparison.data.map((row) => <div key={row.resource_id}>
              <strong>{row.resource_type} · {row.lms_reference_id}</strong>
              <p>{t("مشتريات مكتملة", "Completed purchases")}: {formatNumber(row.completed_purchases)} · {t("استردادات", "Refunded purchases")}: {formatNumber(row.refunded_purchases)}</p>
              <div style={{ display: "flex", width: "100%", height: 12, borderRadius: 6, overflow: "hidden", background: "var(--line)" }} aria-label={t("نسبة المشتريات المحتفظ بها والمستردة", "Retained and refunded purchase share")}>
                <span style={{ width: `${row.completed_purchases ? row.retained_purchases / row.completed_purchases * 100 : 0}%`, background: "var(--series-2, #10b981)" }} />
                <span style={{ width: `${row.completed_purchases ? row.refunded_purchases / row.completed_purchases * 100 : 0}%`, background: "var(--series-4, #ef4444)" }} />
              </div>
            </div>)}
          </div> : !refundComparison.isLoading && !refundComparison.isError ? <p>{t("لا توجد موارد مرتبطة.", "No linked resources.")}</p> : null}
        </div>
      </section> : null}
      {data.b2c ? <section className="cd-card cd-s12">
        <div className="cd-card__h"><h2><Icon name="clock" />{t("مدة الموارد", "Resource durations")}</h2></div>
        <div className="cd-card__b">
          <p className="cd-muted" style={{ marginBlockEnd: 12 }}>
            {t(
              "المدة هنا هي المصدر المعتمد للبحث (بالدقائق) ولا تعتمد على المزامنة القديمة.",
              "This duration (minutes) is the search source of truth and no longer depends on the legacy sync.",
            )}
          </p>
          {resourcesQuery.isLoading ? <p>{t("جارٍ التحميل…", "Loading…")}</p> : null}
          {resourcesQuery.isError ? <p role="alert">{t("تعذّر تحميل الموارد.", "Could not load resources.")}</p> : null}
          {!resourcesQuery.isLoading && !resourcesQuery.isError && resources.length === 0 ? (
            <p>{t("لا توجد موارد مرتبطة.", "No linked resources.")}</p>
          ) : null}
          {resources.length ? <div style={{ display: "grid", gap: 14 }}>
            {resources.map((resource) => {
              const value =
                durationDraft[resource.resource_id] ??
                (resource.duration_minutes == null ? "" : String(resource.duration_minutes));
              const pending =
                saveDuration.isPending && saveDuration.variables?.resourceId === resource.resource_id;
              return (
                <div key={resource.resource_id} style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <strong>{resource.title || resource.lms_reference_id}</strong>
                    <p className="cd-muted" style={{ margin: 0 }}>
                      {resource.resource_type} · <span className="cd-ltr">{resource.lms_reference_id}</span>
                      {resource.duration_minutes != null
                        ? ` · ${t("حالياً", "currently")} ${formatNumber(resource.duration_minutes)} ${t("دقيقة", "min")}`
                        : ""}
                    </p>
                  </div>
                  <div style={{ width: 170 }}>
                    <label className="ma-label" htmlFor={`resource-duration-${resource.resource_id}`}>
                      {t("المدة (دقيقة)", "Duration (minutes)")}
                    </label>
                    <input
                      id={`resource-duration-${resource.resource_id}`}
                      className="ma-input"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={value}
                      onChange={(event) =>
                        setDurationDraft((prev) => ({ ...prev, [resource.resource_id]: event.target.value }))
                      }
                    />
                  </div>
                  <button
                    type="button"
                    className="ma-btn ma-btn--sm ma-btn--primary"
                    disabled={pending}
                    onClick={() => saveDuration.mutate({ resourceId: resource.resource_id, value })}
                  >
                    {t("حفظ", "Save")}
                  </button>
                </div>
              );
            })}
          </div> : null}
        </div>
      </section> : null}
      {/* Description */}
      <section className="cd-card cd-s7">
        <div className="cd-card__h">
          <h2>
            <Icon name="file" />
            {t("الوصف التعريفي", "Description")}
          </h2>
          <AppLink className="ma-btn ma-btn--sm ma-btn--soft" to={studioHref(productRef)}>
            <Icon name="edit" className="cd-ic--sm" />
            {t("تعديل في الاستوديو", "Edit in Studio")}
          </AppLink>
        </div>
        <div className="cd-card__b">
          {rawDesc ? (
            <div className="cd-richtext">
              <RichHtml html={rawDesc} />
            </div>
          ) : (
            <span className="cd-unset">{t("لم يتم تحديد وصف للدورة", "No description provided")}</span>
          )}

          {hasRawHtml && !descDismissed && (
            <div className="ma-alert ma-alert--warning" style={{ marginBlockStart: 16 }}>
              <Icon name="alert" />
              <div style={{ flex: 1 }}>
                <p className="ma-alert__title">
                  {t(
                    "يحتوي الوصف على وسوم HTML من النظام القديم",
                    "Description contains raw legacy HTML tags"
                  )}
                </p>
                <div
                  className="cd-code"
                  style={{
                    marginBlockStart: 8,
                    maxHeight: 120,
                    overflow: "auto",
                    background: "rgba(0,0,0,0.06)",
                    fontSize: 12,
                  }}
                >
                  {rawDesc}
                </div>
                <div style={{ marginBlockStart: 8 }}>
                  <button
                    type="button"
                    className="ma-btn ma-btn--sm ma-btn--soft"
                    onClick={() => setDescDismissed(true)}
                  >
                    {t("إخفاء التنبيه", "Dismiss")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Legacy System Mapping */}
      <section className="cd-card cd-s5">
        <div className="cd-card__h">
          <h2>
            <Icon name="link" />
            {t("ربط النظام القديم", "Legacy System")}
          </h2>
        </div>
        <div className="cd-card__b">
          <dl className="cd-dl">
            <div>
              <dt>{t("المعرف في النظام القديم", "Legacy ID")}</dt>
              <dd className="cd-ltr">{data.links.legacy_id ?? "—"}</dd>
            </div>
            <div>
              <dt>{t("نوع العنصر القديم", "Legacy kind")}</dt>
              <dd className="cd-ltr">{data.links.legacy_kind ?? "—"}</dd>
            </div>
            <div>
              <dt>{t("المرجع الموحد", "Unified ref")}</dt>
              <dd className="cd-ltr">{data.product.ref}</dd>
            </div>
            <div>
              <dt>{t("المصدر الحالي", "Primary source")}</dt>
              <dd className="cd-ltr">{data.product.source}</dd>
            </div>
          </dl>
          {data.links.legacy_id && (
            <div style={{ marginBlockStart: 12 }}>
              <span className="cd-chip cd-chip--plain cd-chip--b2c">
                {t("مرتبط مع منصة Legacy", "Linked with Legacy Platform")}
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Media Gallery */}
      <section className="cd-card cd-s7">
        <div className="cd-card__h">
          <h2>
            <Icon name="image" />
            {t("الوسائط والصور", "Media")}
          </h2>
          <span className="cd-chip cd-chip--plain cd-num">{mediaItems.length}</span>
        </div>
        <div className="cd-card__b">
          {mediaItems.length === 0 ? (
            <div className="cd-empty">
              <Icon name="image" />
              <strong>{t("لا توجد صور مرفوعة بعد", "No media files uploaded yet")}</strong>
            </div>
          ) : (
            <div className="cd-gallery">
              {mediaItems.map((m, idx) => (
                <div key={idx} className="cd-tile">
                  <div className="cd-tile__m" style={{ overflow: "hidden" }}>
                    {m.url ? (
                      <img
                        src={m.url}
                        alt={m.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Icon name="image" />
                    )}
                    {m.kind === "cover" && (
                      <span className="ma-tag ma-tag--ink" style={{ position: "absolute", top: 8, right: 8 }}>
                        {t("غلاف", "Cover")}
                      </span>
                    )}
                  </div>
                  <div className="cd-tile__f">
                    <span>{m.name}</span>
                    <span className="cd-muted cd-ltr">{m.meta || ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginBlockStart: 12 }}>
            <AppLink className="cd-drop" to={studioHref(productRef)}>
              <Icon name="upload" />
              {t("إدارة الوسائط في الاستوديو", "Manage media in Studio")}
            </AppLink>
          </div>
        </div>
      </section>

      {/* Attachments / Studio Assets */}
      <section className="cd-card cd-s5">
        <div className="cd-card__h">
          <h2>
            <Icon name="file" />
            {t("الملفات والمرفقات", "Attachments")}
          </h2>
          <span className="cd-chip cd-chip--plain cd-num">{assets.length}</span>
        </div>
        <div className="cd-card__b">
          {assets.length === 0 ? (
            <div className="cd-empty" style={{ padding: "16px 0" }}>
              <Icon name="file" />
              <strong style={{ fontSize: 13 }}>{t("لا توجد ملفات مرفقة", "No attachments")}</strong>
            </div>
          ) : (
            <div className="cd-files">
              {assets.map((asset) => (
                <div key={asset.asset_id} className="cd-file">
                  <Icon name="file" />
                  <span className="cd-file__t">{asset.filename || asset.asset_id}</span>
                  <span className="cd-muted cd-ltr" style={{ fontSize: 12 }}>
                    {formatFileSize(asset.size_bytes)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginBlockStart: 12 }}>
            <AppLink className="cd-drop" to={studioHref(productRef)}>
              <Icon name="upload" />
              {t("رفع ملفات عبر الاستوديو", "Upload files via Studio")}
            </AppLink>
          </div>
        </div>
      </section>
    </div>
  );
}

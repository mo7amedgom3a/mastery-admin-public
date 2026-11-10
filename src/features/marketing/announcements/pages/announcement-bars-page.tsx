import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  announcementsKeys,
  createAnnouncementBar,
  duplicateAnnouncementBar,
  listAnnouncementBars,
  setAnnouncementBarStatus,
  type AnnouncementBarAdmin,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, ErrorAlert, PageHead } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList, type ListFilter } from "@/components/ui/paged-list";

import { BAR_STATUS, cssBackground, PLACEMENTS, PRESETS } from "../model";
import "../announcements.css";

/** Marketing → Announcement bars: the promo strips shown above the storefront header. */
export function AnnouncementBarsPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = can("marketing.write");
  const invalidate = () => queryClient.invalidateQueries({ queryKey: announcementsKeys.all });

  const create = useMutation({
    mutationFn: () =>
      createAnnouncementBar({
        name: t("شريط إعلانات جديد", "New announcement bar"),
        priority: 0,
        placements: ["all"],
        audience: "all",
        layout: "rotate",
        rotate_interval_ms: 5000,
        style: PRESETS[0].style,
        dismissible: true,
        dismiss_days: 7,
      }),
    onSuccess: (bar) => {
      void invalidate();
      navigate(`/marketing/announcements/${bar.bar_id}`);
    },
  });
  const duplicate = useMutation({
    mutationFn: (bar: AnnouncementBarAdmin) => duplicateAnnouncementBar(bar.bar_id),
    onSuccess: (bar) => {
      void invalidate();
      navigate(`/marketing/announcements/${bar.bar_id}`);
    },
  });
  const toggle = useMutation({
    mutationFn: (bar: AnnouncementBarAdmin) => setAnnouncementBarStatus(bar.bar_id, bar.status === "active" ? "paused" : "active"),
    onSuccess: invalidate,
  });

  const placementLabel = (value: string) => {
    const known = PLACEMENTS.find((p) => p.value === value);
    return known ? t(known.label.ar, known.label.en) : value.replace(/^path:/, "");
  };

  const columns: Column<AnnouncementBarAdmin>[] = [
    {
      key: "name",
      header: t("الشريط", "Bar"),
      exportValue: (row) => row.name,
      cell: (row) => (
        <AppLink className="ma-link ma-link--plain" to={`/marketing/announcements/${row.bar_id}`}>
          <span className="ma-cell-main" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="ma-ann-swatch" style={{ background: cssBackground(row.style) }} aria-hidden />
            {row.name}
          </span>
          <span className="ma-cell-sub">
            {t(`${row.items.length} عنصر`, `${row.items.length} items`)} · {row.items.map((i) => i.text_ar).join(" · ").slice(0, 80)}
          </span>
        </AppLink>
      ),
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      exportValue: (row) => row.status,
      cell: (row) => (
        <span style={{ display: "inline-flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Badge def={BAR_STATUS[row.status]} />
          {row.status === "active" && !row.live_now ? (
            <Badge def={{ label: { ar: "غير ظاهر الآن", en: "Not showing now" }, tone: "warning" }} />
          ) : null}
        </span>
      ),
    },
    { key: "placements", header: t("الصفحات", "Pages"), exportValue: (row) => row.placements.join(", "), cell: (row) => row.placements.map(placementLabel).join("، ") },
    {
      key: "window",
      header: t("الفترة", "Schedule"),
      exportValue: (row) => `${row.starts_at ?? ""} → ${row.ends_at ?? ""}`,
      cell: (row) => (row.starts_at || row.ends_at ? `${formatDateTime(row.starts_at) || "—"} → ${formatDateTime(row.ends_at) || "—"}` : t("دائم", "Always")),
    },
    { key: "priority", header: t("الأولوية", "Priority"), align: "end", exportKind: "number", exportValue: (row) => row.priority, cell: (row) => <span className="ma-num">{row.priority}</span> },
    {
      key: "actions",
      header: "",
      exportable: false,
      align: "end",
      cell: (row) =>
        canWrite && row.status !== "archived" ? (
          <span style={{ display: "inline-flex", gap: 6 }}>
            <Button
              sm
              disabled={toggle.isPending || (row.status !== "active" && row.items.length === 0)}
              label={row.status === "active" ? t("إيقاف", "Pause") : t("نشر", "Publish")}
              onClick={() => toggle.mutate(row)}
            />
            <Button sm kind="ghost" disabled={duplicate.isPending} label={t("نسخ", "Duplicate")} onClick={() => duplicate.mutate(row)} />
          </span>
        ) : null,
    },
  ];

  const filters: ListFilter[] = [
    {
      key: "status",
      label: t("كل الحالات (عدا المؤرشفة)", "All but archived"),
      options: (["active", "paused", "draft", "archived"] as const).map((s) => ({ value: s, label: t(BAR_STATUS[s].label.ar, BAR_STATUS[s].label.en) })),
    },
  ];

  return (
    <>
      <PageHead
        title={t("أشرطة الإعلانات", "Announcement bars")}
        sub={t(
          "الشريط الملون أعلى رأس المتجر: عروض، كوبونات، اشتراكات وفعاليات. يظهر للزائر الشريط الأعلى أولوية المطابق للصفحة.",
          "The coloured strip above the storefront header: offers, coupons, plans and events. Visitors see the highest-priority bar that matches the page.",
        )}
        actions={
          canWrite ? (
            <Button kind="primary" icon="plus" disabled={create.isPending} label={t("شريط جديد", "New bar")} onClick={() => create.mutate()} />
          ) : null
        }
      />
      <ErrorAlert error={create.error ?? duplicate.error ?? toggle.error} title={t("تعذّر تنفيذ العملية", "Couldn't complete the action")} />
      <PagedList
        queryKeyBase={announcementsKeys.all}
        fetchPage={({ query, offset, limit, filters: selected }) =>
          listAnnouncementBars({ q: query || undefined, status: (selected.status || undefined) as never, limit, offset })
        }
        columns={columns}
        searchPlaceholder={t("ابحث بالاسم…", "Search by name…")}
        filters={filters}
        empty={t("لا أشرطة بعد. أنشئ أول شريط للعروض.", "No bars yet. Create your first promo bar.")}
        exportConfig={{ filename: "announcement-bars", title: t("أشرطة الإعلانات", "Announcement bars"), fetchSize: 100 }}
      />
    </>
  );
}

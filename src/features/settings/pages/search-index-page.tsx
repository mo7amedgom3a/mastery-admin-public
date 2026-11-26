import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { refreshIndex, searchIndexKeys, searchIndexQueries, type IndexOverview } from "@/lib/api";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import { Alert, Button, Card, Dl, ErrorAlert, Kpi, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";

import { LiveTestCard } from "@/features/settings/components/search-index/live-test-card";
import { ProductsCard } from "@/features/settings/components/search-index/products-card";
import { RunsCard } from "@/features/settings/components/search-index/runs-card";

/**
 * Content indexing console: the vector index behind smart search and the AI advisor.
 * Shows what is indexed, starts (re)indexing, follows the runs and live-tests keywords.
 */
export default function SearchIndexPage() {
  const t = useT();
  const queryClient = useQueryClient();
  const canWrite = useCan("searchIndex.write");
  const overview = useQuery(searchIndexQueries.overview());
  const [refreshMode, setRefreshMode] = useState<"changed" | "force" | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(null);

  const refresh = useMutation({
    mutationFn: (force: boolean) => refreshIndex(force),
    onSuccess: async (run) => {
      setRefreshMode(null);
      toast.success(t("بدأ تحديث الفهرس", "Index refresh started"));
      setOpenRunId(run.workflow_id);
      await queryClient.invalidateQueries({ queryKey: searchIndexKeys.runs() });
    },
    onError: (error) => {
      setRefreshMode(null);
      toast.error(error instanceof Error ? error.message : t("تعذّر بدء التحديث", "Couldn't start the refresh"));
    },
  });
  const data = overview.data;

  return (
    <>
      <PageHead
        title={t("فهرسة المحتوى", "Content indexing")}
        sub={t(
          "الفهرس الدلالي الذي يعتمد عليه البحث الذكي والمستشار: ما المفهرس، إعادة الفهرسة، متابعة العمليات واختبار الكلمات مباشرة.",
          "The semantic index behind smart search and the AI advisor: what's indexed, re-indexing, run status and live keyword tests.",
        )}
        actions={
          <>
            <Button sm icon="refresh" label={t("تحديث", "Refresh")}
              onClick={() => void queryClient.invalidateQueries({ queryKey: searchIndexKeys.all })} />
            {canWrite ? (
              <>
                <Button sm kind="primary" icon="play" label={t("فهرسة التغييرات الآن", "Index changes now")}
                  disabled={refresh.isPending || data?.temporal_configured === false} onClick={() => setRefreshMode("changed")} />
                <Button sm kind="secondary" icon="zap" label={t("إعادة تضمين الكل", "Re-embed everything")}
                  disabled={refresh.isPending || data?.temporal_configured === false} onClick={() => setRefreshMode("force")} />
              </>
            ) : null}
          </>
        }
      />

      {overview.isLoading ? <Loading /> : null}
      <ErrorAlert error={overview.error} />
      {data ? <ConfigAlerts data={data} /> : null}
      {data ? <OverviewKpis data={data} /> : null}
      {data ? <StoreCard data={data} /> : null}

      <LiveTestCard />
      <RunsCard openRunId={openRunId} onOpenRun={setOpenRunId} />
      <ProductsCard onStarted={setOpenRunId} />

      <ConfirmModal
        open={refreshMode !== null}
        onOpenChange={(open) => (!open ? setRefreshMode(null) : undefined)}
        tone="primary"
        title={refreshMode === "force"
          ? t("إعادة تضمين كل المحتوى؟", "Re-embed all content?")
          : t("فهرسة كل التغييرات الآن؟", "Index all changes now?")}
        message={refreshMode === "force"
          ? t("يُعاد تضمين كل أجزاء كل المنتجات حتى غير المتغيّرة (قد يستغرق 20 دقيقة). يبقى البحث يعمل أثناء ذلك.",
              "Every chunk of every product is embedded again, even unchanged ones (can take ~20 minutes). Search keeps working meanwhile.")
          : t("نفس التحديث الأسبوعي: يُقرأ كل منتج، تُضمَّن النصوص التي تغيّرت فقط، وتُزال المنتجات التي خرجت من الكتالوج.",
              "Same as the weekly refresh: every product is re-read, only changed text is embedded, and products that left the catalog are removed.")}
        confirmLabel={t("بدء", "Start")}
        loading={refresh.isPending}
        onConfirm={() => refresh.mutate(refreshMode === "force")}
      />
    </>
  );
}

function ConfigAlerts({ data }: { data: IndexOverview }) {
  const t = useT();
  return (
    <>
      {!data.semantic_search_enabled ? (
        <Alert kind="warning" title={t("البحث الدلالي معطّل", "Semantic search is off")}>
          {t("البحث في المتجر يستخدم الكلمات فقط في هذه البيئة.", "Storefront search uses keywords only in this environment.")}
        </Alert>
      ) : null}
      {!data.temporal_configured ? (
        <Alert kind="warning" title={t("عامل الفهرسة غير متصل", "Indexing worker not connected")}>
          {t("Temporal غير مُعد هنا، فلا يمكن بدء الفهرسة.", "Temporal isn't configured here, so indexing can't be started.")}
        </Alert>
      ) : null}
      {data.totals.orphan_products > 0 ? (
        <Alert kind="info" title={t("منتجات مؤرشفة ما زالت في الفهرس", "Archived products still in the index")}>
          {t(`${data.totals.orphan_products} منتج غير منشور ما زال له متجهات. «فهرسة التغييرات الآن» يزيلها.`,
             `${data.totals.orphan_products} unpublished products still have vectors. "Index changes now" removes them.`)}
        </Alert>
      ) : null}
    </>
  );
}

function OverviewKpis({ data }: { data: IndexOverview }) {
  const t = useT();
  const { totals, schedule, store } = data;
  return (
    <div className="ma-kpis" data-testid="index-kpis">
      <Kpi icon="layers" label={t("منتجات مفهرسة", "Products indexed")}
        value={`${formatNumber(totals.indexed_products + totals.stale_products)} / ${formatNumber(totals.indexable_products)}`}
        meta={t("المسودات والمنشورة", "drafts and published")} />
      <Kpi icon="alert" label={t("تغيّرت بعد الفهرسة", "Changed since indexing")} value={formatNumber(totals.stale_products)}
        meta={t("تُحدَّث في التشغيل القادم", "updated on the next run")} />
      <Kpi icon="x" label={t("غير مفهرسة", "Not indexed")} value={formatNumber(totals.missing_products)} />
      <Kpi icon="grid" label={t("أجزاء المحتوى", "Content chunks")} value={formatNumber(totals.indexed_chunks)}
        meta={store.vector_count != null ? t(`${formatNumber(store.vector_count)} متجه في المخزن`, `${formatNumber(store.vector_count)} vectors in the store`) : undefined} />
      <Kpi icon="history" label={t("آخر فهرسة", "Last indexed")} value={totals.last_indexed_at ? formatDateTime(totals.last_indexed_at) : "—"} />
      <Kpi icon="calendar" label={t("التحديث المجدول القادم", "Next scheduled refresh")}
        value={schedule?.next_runs[0] ? formatDateTime(schedule.next_runs[0]) : "—"}
        meta={schedule ? (schedule.paused ? t("الجدولة متوقفة", "schedule paused") : t("أسبوعياً", "weekly")) : t("لا جدولة", "no schedule")} />
    </div>
  );
}

function StoreCard({ data }: { data: IndexOverview }) {
  const t = useT();
  const { store, schedule } = data;
  return (
    <Card title={t("إعدادات الفهرس", "Index setup")}>
      <Dl rows={[
        [t("مخزن المتجهات", "Vector store"), <bdi key="store" dir="ltr">{`${store.vector_store === "vectorize" ? "Cloudflare Vectorize" : "AWS S3 Vectors"} · ${store.index_name ?? "—"}`}</bdi>],
        [t("نموذج التضمين", "Embedding model"), <bdi key="model" dir="ltr">{`${store.embedding_model} (${store.dimension}d)`}</bdi>],
        [t("الفهرسة عند التعديل", "Index on catalog edit"), data.auto_index_enabled ? t("مفعّلة", "On") : t("معطّلة", "Off")],
        [t("الجدولة", "Schedule"), schedule ? <bdi key="cron" dir="ltr">{`${schedule.cron.join(", ")} UTC${schedule.paused ? ` · ${t("متوقفة", "paused")}` : ""}`}</bdi> : "—"],
        [t("آخر تشغيل مجدول", "Last scheduled run"), schedule?.last_run_at ? formatDateTime(schedule.last_run_at) : "—"],
      ]} />
    </Card>
  );
}

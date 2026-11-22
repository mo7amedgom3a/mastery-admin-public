import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { labsKeys, labsQueries, restoreScenarioSnapshot, type ScenarioSnapshotSummary } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Badge, Button, Card, Empty, ErrorAlert, Loading } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const REASON: Record<string, { ar: string; en: string; tone: Tone }> = {
  create: { ar: "إنشاء", en: "Created", tone: "info" },
  save: { ar: "حفظ", en: "Saved", tone: "neutral" },
  restore: { ar: "استعادة", en: "Restored", tone: "warning" },
  import: { ar: "استيراد", en: "Imported", tone: "info" },
  publish: { ar: "نشر", en: "Published", tone: "success" },
};

function when(value: string, locale: string): string {
  return new Date(value).toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

/** Counts that make a snapshot recognisable without diffing JSON. */
function outline(content: Record<string, unknown> | null | undefined): string {
  if (!content) return "";
  const pages = Array.isArray(content.pages) ? (content.pages as { blocks?: unknown[] }[]) : null;
  const parts: string[] = [];
  if (pages) {
    parts.push(`${pages.length} pages`);
    parts.push(`${pages.reduce((sum, page) => sum + (page.blocks?.length ?? 0), 0)} blocks`);
  }
  if (Array.isArray(content.fields)) parts.push(`${content.fields.length} fields`);
  if (Array.isArray(content.personas)) parts.push(`${content.personas.length} personas`);
  return parts.join(" · ");
}

/**
 * Draft history of one scenario (any engine). Restoring writes the snapshot as a new revision, so
 * nothing is lost: the version being replaced stays in the history too.
 */
export function HistoryPanel({
  labId,
  scenarioId,
  baseRevision,
  canWrite,
  beforeRestore,
  onRestored,
}: {
  labId: string;
  scenarioId: string;
  baseRevision: number;
  canWrite: boolean;
  /** Save pending edits first so the restore is not rejected as stale. */
  beforeRestore?: () => Promise<void>;
  onRestored: () => void | Promise<void>;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const history = useQuery(labsQueries.history(labId, scenarioId));
  const [viewing, setViewing] = useState<ScenarioSnapshotSummary | null>(null);
  const detail = useQuery({
    ...labsQueries.snapshot(labId, scenarioId, viewing?.snapshot_id ?? ""),
    enabled: Boolean(viewing),
  });

  const restore = useMutation({
    mutationFn: async (snapshotId: string) => {
      await beforeRestore?.();
      return restoreScenarioSnapshot(labId, scenarioId, snapshotId, baseRevision);
    },
    onSuccess: async () => {
      setViewing(null);
      await queryClient.invalidateQueries({ queryKey: labsKeys.history(labId, scenarioId) });
      await onRestored();
      toast.success(t("استُعيدت النسخة كمسودة جديدة", "Restored as a new draft revision"));
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : String(error)),
  });

  const locale = t("ar", "en");

  return (
    <Card
      title={t("سجل المسودة", "Draft history")}
      actions={
        <Button
          sm
          kind="ghost"
          icon="refresh"
          label={t("تحديث", "Refresh")}
          onClick={() => void queryClient.invalidateQueries({ queryKey: labsKeys.history(labId, scenarioId) })}
        />
      }
    >
      <p className="ma-help">
        {t(
          "كل حفظ يُسجَّل هنا؛ الحفظ التلقائي المتتالي من نفس المحرر خلال دقيقتين يُدمج في نسخة واحدة (حتى 10 دقائق لكل نسخة). تحتفظ بآخر 100 نسخة.",
          "Every save is recorded here; consecutive autosaves by the same editor within two minutes are merged (up to 10 minutes per entry). The newest 100 are kept.",
        )}
      </p>
      {history.error ? <ErrorAlert error={history.error} /> : null}
      {history.isLoading ? (
        <Loading />
      ) : !history.data?.items.length ? (
        <Empty text={t("لا سجل بعد.", "No history yet.")} />
      ) : (
        <ol className="ma-list" style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
          {history.data.items.map((item, index) => {
            const reason = REASON[item.reason] ?? REASON.save;
            return (
              <li
                key={item.snapshot_id}
                className="ma-cell-flex"
                style={{
                  justifyContent: "space-between",
                  gap: 8,
                  padding: "var(--space-2) var(--space-3)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-control)",
                }}
              >
                <span className="ma-cell-flex" style={{ gap: 8, flexWrap: "wrap" }}>
                  <Badge def={{ label: { ar: reason.ar, en: reason.en }, tone: reason.tone }} />
                  <strong>{when(item.updated_at, locale)}</strong>
                  <span className="ma-help">
                    r{item.revision} · {kb(item.size_bytes)}
                    {item.edits > 1 ? ` · ${t(`${item.edits} تعديلات`, `${item.edits} edits`)}` : ""}
                    {index === 0 ? ` · ${t("الحالية", "current")}` : ""}
                  </span>
                </span>
                <Button sm kind="ghost" icon="eye" label={t("عرض", "View")} onClick={() => setViewing(item)} />
              </li>
            );
          })}
        </ol>
      )}

      <Modal
        open={Boolean(viewing)}
        onOpenChange={(open) => (open ? undefined : setViewing(null))}
        title={viewing ? `${t("نسخة", "Snapshot")} r${viewing.revision} · ${when(viewing.updated_at, locale)}` : ""}
        size="lg"
        footer={
          <>
            <Button kind="ghost" label={t("إغلاق", "Close")} onClick={() => setViewing(null)} />
            <Button
              kind="primary"
              label={restore.isPending ? t("جارٍ الاستعادة…", "Restoring…") : t("استعادة هذه النسخة", "Restore this version")}
              disabled={!canWrite || restore.isPending || !viewing || history.data?.items[0]?.snapshot_id === viewing?.snapshot_id}
              onClick={() => viewing && restore.mutate(viewing.snapshot_id)}
            />
          </>
        }
      >
        {detail.isLoading ? <Loading /> : null}
        {detail.error ? <ErrorAlert error={detail.error} /> : null}
        {detail.data ? (
          <>
            <p className="ma-help">{outline(detail.data.content)}</p>
            <pre
              dir="ltr"
              style={{
                maxHeight: "50vh",
                overflow: "auto",
                fontSize: 12,
                background: "var(--surface-alt)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-control)",
              }}
            >
              {JSON.stringify(detail.data.content, null, 2)}
            </pre>
          </>
        ) : null}
      </Modal>
    </Card>
  );
}

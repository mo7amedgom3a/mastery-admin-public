import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Button, ErrorAlert } from "@/components/ui/kit";

export function Badge({ tone, children, className }: { tone?: string; children: React.ReactNode; className?: string }) {
  return <span className={cn("ma-badge", tone ? `ma-badge--${tone}` : undefined, className)}>{children}</span>;
}

export function Tag({ tone, children, className }: { tone?: string; children: React.ReactNode; className?: string }) {
  return <span className={cn("ma-tag", tone ? `ma-tag--${tone}` : undefined, className)}>{children}</span>;
}

const STATUS_TONES: Record<string, string> = {
  active: "success",
  published: "success",
  paid: "success",
  succeeded: "success",
  fulfilled: "success",
  pending: "warning",
  pending_payment: "warning",
  requested: "warning",
  draft: "info",
  failed: "danger",
  cancelled: "danger",
  blocked: "danger",
  suspended: "warning",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="ma-muted">—</span>;
  return <Badge tone={STATUS_TONES[status] ?? undefined}>{status.replace(/_/g, " ")}</Badge>;
}

/** Renders a load error as the kit danger alert, otherwise the children. */
export function PageState({ error, children }: { error?: unknown; children: React.ReactNode }) {
  if (error) return <ErrorAlert error={error} />;
  return <>{children}</>;
}

export function StatTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="ma-kpi">
      <div className="ma-kpi__label">{label}</div>
      <div className="ma-kpi__value">{value}</div>
      {hint ? <div className="ma-kpi__meta">{hint}</div> : null}
    </div>
  );
}

/** Table footer: "1–25 of 185" on the start side, previous/next on the end side. */
export function Pagination({
  total,
  limit,
  offset,
  onPage,
}: {
  total: number;
  limit: number;
  offset: number;
  onPage: (offset: number) => void;
}) {
  const t = useT();
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <nav className="ma-pager" aria-label={t("التنقل بين الصفحات", "Pagination")}>
      <span className="ma-pager__range">
        {t(
          `${formatNumber(from)}–${formatNumber(to)} من ${formatNumber(total)}`,
          `${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(total)}`,
        )}
      </span>
      <span className="ma-pager__btns">
        <Button sm icon="chevronStart" iconDir label={t("السابق", "Previous")} disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - limit))} />
        <Button sm icon="chevronEnd" iconDir iconEnd label={t("التالي", "Next")} disabled={to >= total} onClick={() => onPage(offset + limit)} />
      </span>
    </nav>
  );
}

export type { Column } from "@/components/ui/data-table";

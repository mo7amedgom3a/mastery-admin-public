import { useRef, useState, type ReactNode } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";

import { useT } from "@/lib/i18n";
import { ErrorAlert } from "@/components/ui/kit";
import type { PageResult } from "@/components/ui/paged-list";
import "@/styles/kanban.css";

export type BoardColumn = { value: string; label: string };
export type KanbanConfig<T> = {
  columns: BoardColumn[];
  visibleStage?: string;
  getId: (row: T) => string;
  getStage: (row: T) => string;
  renderCard: (row: T) => ReactNode;
  move: (row: T, stage: string) => Promise<unknown>;
  canMove: boolean;
  queryKey: readonly unknown[];
  fetchPage: (stage: string, offset: number) => Promise<PageResult<T>>;
  invalidateKeys: readonly (readonly unknown[])[];
};
type Move<T> = { row: T; from: string; to: string };

export function ViewToggle({ value, onChange }: { value: "board" | "table"; onChange: (view: "board" | "table") => void }) {
  const t = useT();
  return <div className="ma-board-toggle" role="group" aria-label={t("طريقة العرض", "View")}>
    {(["board", "table"] as const).map((view) => <button key={view} type="button" className="ma-btn ma-btn--soft ma-btn--sm"
      aria-pressed={value === view} onClick={() => onChange(view)}>{view === "board" ? t("لوحة", "Board") : t("جدول", "Table")}</button>)}
  </div>;
}

export function KanbanBoard<T>(props: KanbanConfig<T>) {
  const t = useT();
  const client = useQueryClient();
  const [moves, setMoves] = useState<Record<string, Move<T>>>({});
  const pending = useRef(new Set<string>());
  const dragged = useRef<T | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [announcement, setAnnouncement] = useState("");
  const move = async (row: T, to: string) => {
    const id = props.getId(row);
    if (!props.canMove || pending.current.has(id) || props.getStage(row) === to) return;
    pending.current.add(id);
    setError(null);
    setMoves((prev) => ({ ...prev, [id]: { row, from: props.getStage(row), to } }));
    try {
      await props.move(row, to);
      await Promise.all(props.invalidateKeys.map((queryKey) => client.invalidateQueries({ queryKey })));
      setAnnouncement(t("تم تحديث الحالة", "Status updated"));
    } catch (err) {
      setError(err);
      setAnnouncement(t("تعذر تحديث الحالة", "Could not update status"));
    } finally {
      pending.current.delete(id);
      setMoves((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
  };
  return <div>
    <ErrorAlert error={error} />
    <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    <div className="ma-board" aria-label={t("لوحة الحالات", "Status board")}
      onDragOver={(event) => {
        if (!dragged.current) return;
        const board = event.currentTarget;
        const bounds = board.getBoundingClientRect();
        // scrollLeft uses physical direction in both LTR and RTL browsers.
        if (event.clientX < bounds.left + 56) board.scrollLeft -= 28;
        else if (event.clientX > bounds.right - 56) board.scrollLeft += 28;
      }}
      onDragEnd={() => { dragged.current = null; setDraggingId(null); setDropStage(null); }}>
      {props.columns.filter((column) => !props.visibleStage || column.value === props.visibleStage).map((column) => <KanbanColumn key={column.value} {...props} column={column}
        moves={moves} draggingId={draggingId} dropStage={dropStage} onHover={setDropStage} getDragged={() => dragged.current}
        setDragged={(row) => { dragged.current = row; setDraggingId(row ? props.getId(row) : null); setDropStage(null); }} onMove={move} />)}
    </div>
  </div>;
}

function KanbanColumn<T>({ column, moves, draggingId, dropStage, onHover, getDragged, setDragged, onMove, ...props }: KanbanConfig<T> & {
  dropStage: string | null; onHover: (stage: string | null) => void;
  column: BoardColumn; moves: Record<string, Move<T>>; draggingId: string | null; getDragged: () => T | null; setDragged: (row: T | null) => void;
  onMove: (row: T, to: string) => Promise<void>;
}) {
  const t = useT();
  const query = useInfiniteQuery({
    queryKey: [...props.queryKey, column.value],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => props.fetchPage(column.value, pageParam),
    getNextPageParam: (page) => page.offset + page.items.length < page.total && page.items.length > 0
      ? page.offset + page.items.length : undefined,
    refetchInterval: 30_000,
  });
  const loaded = query.data?.pages.flatMap((page) => page.items) ?? [];
  const rows = loaded.filter((row) => !moves[props.getId(row)]);
  Object.values(moves).filter((move) => move.to === column.value).forEach((move) => rows.push(move.row));
  const unique = [...new Map(rows.map((row) => [props.getId(row), row])).values()];
  const delta = Object.values(moves).reduce((count, move) => {
    const alreadyHere = loaded.some((row) => props.getId(row) === props.getId(move.row));
    return count + (move.to === column.value && !alreadyHere ? 1 : 0) - (move.from === column.value && alreadyHere ? 1 : 0);
  }, 0);
  return <section className={`ma-board-column${dropStage === column.value && draggingId ? " ma-board-column--over" : ""}`} aria-label={column.label}
    data-stage={column.value}
    onDragEnter={(event) => { if (props.canMove && getDragged()) { event.preventDefault(); onHover(column.value); } }}
    onDragOver={(event) => { if (props.canMove && getDragged()) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; onHover(column.value); } }}
    onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onHover(null); }}
    onDrop={(event) => { event.preventDefault(); onHover(null); const row = getDragged(); if (row) void onMove(row, column.value); setDragged(null); }}>
    <div className="ma-board-column-head"><h3>{column.label}</h3><span className="ma-tag">{query.data ? Math.max(0, query.data.pages[0].total + delta) : "…"}</span></div>
    <ErrorAlert error={query.error} />
    {query.isPending ? <p className="ma-cell-sub">{t("جارٍ التحميل…", "Loading…")}</p> : null}
    {!query.isPending && !query.error && !unique.length ? <p className="ma-board-empty">{t("لا توجد بطاقات", "No cards")}</p> : null}
    {unique.map((row) => {
      const id = props.getId(row);
      const saving = Boolean(moves[id]);
      return <article key={id} className={`ma-board-card${draggingId === id ? " ma-board-card--dragging" : ""}`} aria-busy={saving} data-card-id={id}
        draggable={props.canMove && !saving}
        onDragStart={(event) => {
          const target = event.target as Element;
          if (!props.canMove || saving || target.closest("select, input, textarea, button:not(.ma-board-drag)")) {
            event.preventDefault();
            return;
          }
          setDragged(row);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", id);
          const bounds = event.currentTarget.getBoundingClientRect();
          event.dataTransfer.setDragImage(event.currentTarget, event.clientX - bounds.left, event.clientY - bounds.top);
        }}
        onDragEnd={() => { setDragged(null); onHover(null); }}>
        {props.canMove ? <div className="ma-board-card-actions">
          <button className="ma-board-drag" type="button" draggable={!saving} disabled={saving}
            aria-label={t("اسحب لنقل البطاقة", "Drag to move card")}><GripVertical size={16} /></button>
          <label className="ma-board-move"><span className="sr-only">{t("نقل إلى", "Move to")}</span>
            <select className="ma-select" aria-label={t("نقل إلى", "Move to")} disabled={saving}
              value={moves[id]?.to ?? props.getStage(row)} onChange={(event) => void onMove(row, event.target.value)}>
              {props.columns.map((stage) => <option key={stage.value} value={stage.value}>{stage.label}</option>)}
            </select></label>
        </div> : null}
        {props.renderCard(row)}
        {saving ? <p className="ma-cell-sub" role="status">{t("جارٍ الحفظ…", "Saving…")}</p> : null}
      </article>;
    })}
    {query.hasNextPage ? <button className="ma-btn ma-btn--soft ma-btn--sm" type="button" disabled={query.isFetchingNextPage}
      onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? t("جارٍ التحميل…", "Loading…") : t("تحميل المزيد", "Load more")}</button> : null}
    {query.error ? <button type="button" className="ma-btn ma-btn--soft ma-btn--sm" onClick={() => void query.refetch()}>{t("إعادة المحاولة", "Retry")}</button> : null}
  </section>;
}

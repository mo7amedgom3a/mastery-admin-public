import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { GripVertical, Pencil, Trash2 } from "lucide-react";

import {
  announcementsKeys,
  announcementsQueries,
  createAnnouncementItem,
  deleteAnnouncementItem,
  duplicateAnnouncementBar,
  reorderAnnouncementItems,
  setAnnouncementBarStatus,
  updateAnnouncementBar,
  updateAnnouncementItem,
  type AnnouncementBarAdmin,
  type AnnouncementBarStatus,
  type AnnouncementItemAdmin,
  type AnnouncementStyle,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { Alert, Badge, Button, Card, ErrorAlert, Field, FormActions, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";

import { AnnouncementPreviewFrame } from "../components/announcement-preview-frame";
import { ItemModal } from "../components/item-modal";
import { StyleEditor } from "../components/style-editor";
import {
  ACTIONS,
  AUDIENCES,
  BAR_STATUS,
  cssBackground,
  fromLocalInput,
  HIDDEN_REASON,
  itemDraft,
  ITEM_KINDS,
  LAYOUTS,
  PLACEMENTS,
  previewItem,
  refsOf,
  toLocalInput,
  type ItemDraft,
  type PreviewRefs,
} from "../model";
import "../announcements.css";

type Settings = {
  name: string;
  priority: string;
  startsAt: string;
  endsAt: string;
  placements: string[];
  customPaths: string;
  audience: AnnouncementBarAdmin["audience"];
  layout: AnnouncementBarAdmin["layout"];
  intervalSec: string;
  style: AnnouncementStyle;
  dismissible: boolean;
  dismissDays: string;
};

const NAMED = new Set(PLACEMENTS.map((p) => p.value));

function settingsOf(bar: AnnouncementBarAdmin): Settings {
  return {
    name: bar.name,
    priority: String(bar.priority),
    startsAt: toLocalInput(bar.starts_at),
    endsAt: toLocalInput(bar.ends_at),
    placements: bar.placements.filter((p) => NAMED.has(p)),
    customPaths: bar.placements.filter((p) => p.startsWith("path:")).map((p) => p.slice(5)).join("\n"),
    audience: bar.audience,
    layout: bar.layout,
    intervalSec: String(Math.round(bar.rotate_interval_ms / 1000)),
    style: bar.style,
    dismissible: bar.dismissible,
    dismissDays: String(bar.dismiss_days),
  };
}

function placementsOf(s: Settings): string[] {
  const paths = s.customPaths
    .split(/\n|,/)
    .map((p) => p.trim())
    .filter((p) => p.startsWith("/"))
    .map((p) => `path:${p}`);
  const all = [...s.placements, ...paths];
  return all.length ? all : ["all"];
}

type Editing = { item: AnnouncementItemAdmin | null; draft: ItemDraft; refs: PreviewRefs };

export function AnnouncementBarEditorPage() {
  const { barId = "" } = useParams();
  const query = useQuery(announcementsQueries.detail(barId));
  if (query.error) return <ErrorAlert error={query.error} />;
  if (!query.data) return <Loading />;
  return <Editor key={query.data.bar_id} bar={query.data} />;
}

function Editor({ bar }: { bar: AnnouncementBarAdmin }) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canWrite = can("marketing.write");
  const [settings, setSettings] = useState<Settings>(() => settingsOf(bar));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<AnnouncementItemAdmin | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  // Optimistic order while a reorder is saving; a newer server version (every item change bumps it) wins.
  const [localOrder, setLocalOrder] = useState<{ version: number; ids: string[] } | null>(null);
  const order = localOrder && localOrder.version === bar.version ? localOrder.ids : bar.items.map((i) => i.item_id);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const set = <K extends keyof Settings>(key: K) => (value: Settings[K]) => setSettings((s) => ({ ...s, [key]: value }));
  const refresh = () => queryClient.invalidateQueries({ queryKey: announcementsKeys.all });
  const dirty = JSON.stringify(settings) !== JSON.stringify(settingsOf(bar));

  const save = useMutation({
    mutationFn: () =>
      updateAnnouncementBar(bar.bar_id, {
        name: settings.name.trim(),
        priority: Number.parseInt(settings.priority || "0", 10),
        starts_at: fromLocalInput(settings.startsAt),
        ends_at: fromLocalInput(settings.endsAt),
        placements: placementsOf(settings),
        audience: settings.audience,
        layout: settings.layout,
        rotate_interval_ms: Math.round(Number(settings.intervalSec || 5) * 1000),
        style: settings.style,
        dismissible: settings.dismissible,
        dismiss_days: Number.parseInt(settings.dismissDays || "0", 10),
      }),
    onSuccess: () => {
      toast.success(t("تم حفظ الشريط", "Bar saved"));
      void refresh();
    },
  });

  const status = useMutation({
    mutationFn: (next: AnnouncementBarStatus) => setAnnouncementBarStatus(bar.bar_id, next),
    onSuccess: (_, next) => {
      toast.success(next === "active" ? t("الشريط منشور الآن", "The bar is live") : t("تم تحديث الحالة", "Status updated"));
      setConfirmArchive(false);
      void refresh();
      if (next === "archived") navigate("/marketing/announcements");
    },
  });

  const duplicate = useMutation({
    mutationFn: () => duplicateAnnouncementBar(bar.bar_id),
    onSuccess: (copy) => {
      void refresh();
      navigate(`/marketing/announcements/${copy.bar_id}`);
    },
  });

  const saveItem = useMutation({
    mutationFn: async ({ id, body }: { id: string | null; body: ItemDraft }) =>
      id ? updateAnnouncementItem(bar.bar_id, id, body) : createAnnouncementItem(bar.bar_id, body),
    onSuccess: () => {
      setEditing(null);
      void refresh();
    },
  });

  const removeItem = useMutation({
    mutationFn: (item: AnnouncementItemAdmin) => deleteAnnouncementItem(bar.bar_id, item.item_id),
    onSuccess: () => {
      setRemoving(null);
      void refresh();
    },
  });

  const toggleItem = useMutation({
    mutationFn: (item: AnnouncementItemAdmin) => updateAnnouncementItem(bar.bar_id, item.item_id, { is_active: !item.is_active }),
    onSuccess: refresh,
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => reorderAnnouncementItems(bar.bar_id, ids),
    onSuccess: refresh,
  });

  const items = useMemo(
    () => order.map((id) => bar.items.find((i) => i.item_id === id)).filter((i): i is AnnouncementItemAdmin => Boolean(i)),
    [order, bar.items],
  );

  const onDraft = useCallback((draft: ItemDraft, refs: PreviewRefs) => {
    setEditing((current) => (current ? { ...current, draft, refs } : current));
  }, []);

  // The storefront payload: unsaved settings + what visitors would see now, with the item being edited on top.
  const previewBar = useMemo(() => {
    const visible = items
      .filter((item) => item.hidden_reason == null || item.item_id === editing?.item?.item_id)
      .map((item) =>
        editing && editing.item?.item_id === item.item_id
          ? previewItem(editing.draft, editing.refs, item.item_id)
          : previewItem(itemDraft(item), refsOf(item), item.item_id),
      );
    if (editing && !editing.item) visible.push(previewItem(editing.draft, editing.refs, "draft"));
    return {
      id: bar.bar_id,
      version: bar.version,
      placements: placementsOf(settings),
      audience: settings.audience,
      layout: settings.layout,
      rotate_interval_ms: Math.max(2500, Math.round(Number(settings.intervalSec || 5) * 1000)),
      style: settings.style,
      dismissible: settings.dismissible,
      dismiss_days: Number(settings.dismissDays || 0),
      ends_at: null,
      items: visible,
    };
  }, [bar.bar_id, bar.version, items, editing, settings]);

  const drop = (targetId: string) => {
    if (!dragging || dragging === targetId) return;
    const next = order.filter((id) => id !== dragging);
    next.splice(next.indexOf(targetId), 0, dragging);
    setLocalOrder({ version: bar.version, ids: next });
    setDragging(null);
    setOver(null);
    reorder.mutate(next);
  };

  const archived = bar.status === "archived";
  const activeItems = bar.items.filter((i) => i.is_active).length;

  return (
    <>
      <PageHead
        back={{ href: "/marketing/announcements", label: t("أشرطة الإعلانات", "Announcement bars") }}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span className="ma-ann-swatch" style={{ background: cssBackground(settings.style) }} aria-hidden />
            {bar.name}
          </span>
        }
        status={
          <span style={{ display: "inline-flex", gap: 6 }}>
            <Badge def={BAR_STATUS[bar.status]} />
            {bar.status === "active" ? (
              <Badge def={bar.live_now ? { label: { ar: "ظاهر الآن", en: "Showing now" }, tone: "success" } : { label: { ar: "غير ظاهر الآن", en: "Not showing now" }, tone: "warning" }} />
            ) : null}
          </span>
        }
        actions={
          canWrite ? (
            <>
              {bar.status !== "active" ? (
                <Button kind="primary" icon="check" disabled={status.isPending || dirty || activeItems === 0} label={t("نشر", "Publish")} onClick={() => status.mutate("active")} />
              ) : (
                <Button disabled={status.isPending} label={t("إيقاف مؤقت", "Pause")} onClick={() => status.mutate("paused")} />
              )}
              <Button kind="ghost" disabled={duplicate.isPending} label={t("نسخ", "Duplicate")} onClick={() => duplicate.mutate()} />
              {!archived ? <Button kind="ghost" label={t("أرشفة", "Archive")} onClick={() => setConfirmArchive(true)} /> : null}
            </>
          ) : null
        }
      />

      {dirty && bar.status !== "active" ? (
        <Alert kind="info" title={t("احفظ قبل النشر", "Save before publishing")}>
          {t("لديك تعديلات غير محفوظة في إعدادات الشريط.", "You have unsaved bar settings.")}
        </Alert>
      ) : null}
      {activeItems === 0 ? (
        <Alert kind="warning" title={t("لا عناصر بعد", "No items yet")}>
          {t("أضف عنصراً واحداً على الأقل (خصم، اشتراك، فعالية…) لتتمكن من النشر.", "Add at least one item (discount, plan, event…) to publish.")}
        </Alert>
      ) : null}
      <ErrorAlert error={status.error ?? duplicate.error ?? reorder.error ?? toggleItem.error} title={t("تعذّر تنفيذ العملية", "Couldn't complete the action")} />

      <div className="ma-ann-layout">
        <div className="ma-ann-layout__form">
          <Card
            title={t(`العناصر (${items.length})`, `Items (${items.length})`)}
            actions={
              canWrite && items.length < 8 ? (
                <Button sm kind="primary" icon="plus" label={t("إضافة عنصر", "Add item")} onClick={() => setEditing({ item: null, draft: itemDraft(null), refs: {} })} />
              ) : null
            }
          >
            {items.length === 0 ? (
              <p className="ma-help">{t("كل عنصر شريحة داخل الشريط: نص قصير، كوبون اختياري وزر.", "Each item is a slide in the bar: short text, an optional coupon and a button.")}</p>
            ) : (
              <ul className="ma-ann-items">
                {items.map((item) => {
                  const kind = ITEM_KINDS.find(([k]) => k === item.kind)?.[1];
                  const action = ACTIONS.find(([a]) => a === item.action_type)?.[1];
                  const reason = item.hidden_reason ? HIDDEN_REASON[item.hidden_reason] : null;
                  return (
                    <li
                      key={item.item_id}
                      className={`ma-ann-item${dragging === item.item_id ? " is-dragging" : ""}${over === item.item_id ? " is-over" : ""}`}
                      draggable={canWrite}
                      onDragStart={(e) => {
                        setDragging(item.item_id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setOver(item.item_id);
                      }}
                      onDragLeave={() => setOver(null)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        drop(item.item_id);
                      }}
                    >
                      <GripVertical size={16} className="ma-ann-item__grip" aria-hidden />
                      <span
                        className="ma-ann-item__dot"
                        style={{ background: item.style_override?.bg_colors?.length ? cssBackground(settings.style, item.style_override.bg_colors) : cssBackground(settings.style) }}
                        aria-hidden
                      />
                      <div className="ma-ann-item__main">
                        <span className="ma-ann-item__text">
                          {item.highlight_ar ? <strong>{item.highlight_ar} </strong> : null}
                          {item.text_ar}
                        </span>
                        <span className="ma-ann-item__meta">
                          <span>{kind ? t(kind.ar, kind.en) : item.kind}</span>
                          <span>· {action ? t(action.ar, action.en) : item.action_type}</span>
                          {item.coupon ? <span className="ma-num">· {item.coupon.code}</span> : null}
                          {item.product ? <span>· {item.product.title ?? item.product.slug}</span> : null}
                          {item.plan ? <span>· {item.plan.title ?? item.plan.slug}</span> : null}
                          {reason ? <Badge def={{ label: reason, tone: "warning" }} /> : null}
                        </span>
                      </div>
                      {canWrite ? (
                        <span className="ma-ann-item__actions">
                          <Button sm kind="ghost" disabled={toggleItem.isPending} label={item.is_active ? t("إخفاء", "Hide") : t("إظهار", "Show")} onClick={() => toggleItem.mutate(item)} />
                          <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" aria-label={t("تعديل", "Edit")} onClick={() => setEditing({ item, draft: itemDraft(item), refs: refsOf(item) })}>
                            <Pencil size={14} aria-hidden />
                          </button>
                          <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" aria-label={t("حذف", "Delete")} onClick={() => setRemoving(item)}>
                            <Trash2 size={14} aria-hidden />
                          </button>
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {items.length > 1 ? <p className="ma-help">{t("اسحب العناصر لتغيير ترتيبها.", "Drag items to reorder them.")}</p> : null}
          </Card>

          <form
            className="ma-form"
            style={{ display: "grid", gap: "var(--space-4)", gridRow: "span 2" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (canWrite && dirty) save.mutate();
            }}
          >
            <Card title={t("التصميم", "Design")}>
              <StyleEditor style={settings.style} onChange={set("style")} />
            </Card>

            <Card title={t("العرض والاستهداف", "Display & targeting")}>
              <div className="ma-form">
                <Field id="bar-name" label={t("الاسم الداخلي", "Internal name")} required maxLength={200} value={settings.name} onChange={set("name")} hint={t("لا يراه الزوار.", "Not shown to visitors.")} />

                <div className="ma-field">
                  <span className="ma-label">{t("يظهر في", "Shows on")}</span>
                  <div className="ma-ann-chips" role="group" aria-label={t("يظهر في", "Shows on")}>
                    {PLACEMENTS.map((p) => {
                      const on = settings.placements.includes(p.value);
                      return (
                        <button
                          key={p.value}
                          type="button"
                          className="ma-ann-chip"
                          aria-pressed={on}
                          onClick={() =>
                            set("placements")(
                              p.value === "all"
                                ? on ? [] : ["all"]
                                : on
                                  ? settings.placements.filter((v) => v !== p.value)
                                  : [...settings.placements.filter((v) => v !== "all"), p.value],
                            )
                          }
                        >
                          {t(p.label.ar, p.label.en)}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Field
                  id="bar-paths"
                  type="textarea"
                  rows={2}
                  dir="ltr"
                  label={t("صفحات محددة (اختياري)", "Specific pages (optional)")}
                  hint={t("مسار في كل سطر. أضف * للمسارات الفرعية، مثل /business*.", "One path per line. Add * for sub-paths, e.g. /business*.")}
                  value={settings.customPaths}
                  onChange={set("customPaths")}
                />

                <div className="ma-form-grid ma-form-grid--2">
                  <Field id="bar-audience" label={t("الجمهور", "Audience")} options={AUDIENCES.map(([v, l]) => [v, t(l.ar, l.en)])} value={settings.audience} onChange={(v) => set("audience")(v as Settings["audience"])} />
                  <Field
                    id="bar-priority"
                    type="number"
                    dir="ltr"
                    min={-1000}
                    max={1000}
                    label={t("الأولوية", "Priority")}
                    hint={t("عند تطابق أكثر من شريط يظهر الأعلى.", "When several bars match, the highest wins.")}
                    value={settings.priority}
                    onChange={set("priority")}
                  />
                  <Field
                    id="bar-layout"
                    label={t("طريقة عرض العناصر", "Item layout")}
                    options={LAYOUTS.map(([v, l]) => [v, t(l.ar, l.en)])}
                    value={settings.layout}
                    onChange={(v) => set("layout")(v as Settings["layout"])}
                    hint={(() => {
                      const help = LAYOUTS.find(([v]) => v === settings.layout)?.[2];
                      return help ? t(help.ar, help.en) : undefined;
                    })()}
                  />
                  {settings.layout !== "marquee" ? (
                    <Field id="bar-interval" type="number" dir="ltr" min={3} max={20} label={t("مدة كل شريحة (ثوانٍ)", "Seconds per slide")} value={settings.intervalSec} onChange={set("intervalSec")} />
                  ) : (
                    <span aria-hidden />
                  )}
                  <Field id="bar-start" type="datetime-local" label={t("يبدأ", "Starts")} hint={t("فارغ = فور النشر.", "Empty = when published.")} value={settings.startsAt} onChange={set("startsAt")} />
                  <Field id="bar-end" type="datetime-local" label={t("ينتهي", "Ends")} hint={t("فارغ = حتى الإيقاف.", "Empty = until paused.")} value={settings.endsAt} min={settings.startsAt || undefined} onChange={set("endsAt")} />
                </div>

                <div className="ma-form-grid ma-form-grid--2">
                  <label className="ma-check" htmlFor="bar-dismissible" style={{ alignSelf: "end" }}>
                    <input id="bar-dismissible" type="checkbox" checked={settings.dismissible} onChange={(e) => set("dismissible")(e.target.checked)} />
                    <span>{t("يمكن للزائر إغلاقه", "Visitors can close it")}</span>
                  </label>
                  {settings.dismissible ? (
                    <Field
                      id="bar-dismiss-days"
                      type="number"
                      dir="ltr"
                      min={0}
                      max={365}
                      label={t("يبقى مخفياً (أيام)", "Stays hidden (days)")}
                      hint={t("أي تعديل على المحتوى يُظهره من جديد.", "Any content edit shows it again.")}
                      value={settings.dismissDays}
                      onChange={set("dismissDays")}
                    />
                  ) : null}
                </div>
              </div>
            </Card>

            {canWrite ? (
              <>
                <ErrorAlert error={save.error} title={t("تعذّر حفظ الشريط", "Couldn't save the bar")} />
                <FormActions>
                  <Button type="submit" kind="primary" icon="check" disabled={!dirty || save.isPending} label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ الإعدادات", "Save settings")} />
                  {dirty ? <Button kind="ghost" label={t("تراجع", "Discard")} onClick={() => setSettings(settingsOf(bar))} /> : null}
                </FormActions>
              </>
            ) : null}
          </form>
        </div>

        <div className="ma-ann-layout__side">
          <Card>
            <AnnouncementPreviewFrame bar={previewBar} />
            <p className="ma-help" style={{ marginBlockStart: "var(--space-2)" }}>
              {t(
                "المعاينة تعرض التعديلات غير المحفوظة. العناصر المخفية (كوبون منتهٍ مثلاً) لا تظهر كما في المتجر.",
                "The preview includes unsaved edits. Hidden items (e.g. an expired coupon) are left out, as on the storefront.",
              )}
            </p>
          </Card>
        </div>
      </div>

      {editing ? (
        <ItemModal
          open
          initial={editing.item ? itemDraft(editing.item) : editing.draft}
          initialRefs={editing.item ? refsOf(editing.item) : {}}
          pending={saveItem.isPending}
          error={saveItem.error}
          onClose={() => {
            saveItem.reset();
            setEditing(null);
          }}
          onDraft={onDraft}
          onSave={(body) => saveItem.mutate({ id: editing.item?.item_id ?? null, body })}
        />
      ) : null}

      <ConfirmModal
        open={removing !== null}
        onOpenChange={(open) => (!open ? setRemoving(null) : undefined)}
        title={t("حذف العنصر", "Delete item")}
        message={t("سيُحذف العنصر من الشريط. إن كان آخر عنصر في شريط منشور فسيتوقف الشريط.", "The item is removed. If it was the last item of a live bar, the bar is paused.")}
        tone="danger"
        loading={removeItem.isPending}
        confirmLabel={t("حذف", "Delete")}
        onConfirm={() => removing && removeItem.mutate(removing)}
      />
      <ConfirmModal
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={t("أرشفة الشريط", "Archive bar")}
        message={t("يختفي الشريط من المتجر ومن القائمة. يمكنك عرضه بفلتر «مؤرشف».", "The bar leaves the storefront and the list. Filter by Archived to see it.")}
        tone="warning"
        loading={status.isPending}
        confirmLabel={t("أرشفة", "Archive")}
        onConfirm={() => status.mutate("archived")}
      />
    </>
  );
}

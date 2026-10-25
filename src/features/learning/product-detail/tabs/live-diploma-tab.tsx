import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createCohort,
  createCohortSession,
  deleteCohort,
  deleteCohortSession,
  liveDiplomaKeys,
  liveDiplomaQueries,
  notifyWaitlist,
  updateCohort,
  updateLiveDiploma,
  updateWaitlistEntry,
  type Cohort,
  type CohortStudent,
  type CohortWrite,
  type LiveDiplomaWrite,
  type SessionWrite,
  type WaitlistEntry as WaitlistRow,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { formatDateTime } from "@/lib/format";
import { Badge, Button, Card, Dl, Empty, ErrorAlert, Field, Loading, Alert } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";

const toIso = (local: string): string => new Date(local).toISOString();

/**
 * A live diploma: its storefront fields, cohorts and — per cohort — sessions, students and the waitlist.
 * Everything is served by `/admin/catalog/live-diplomas/{slug}/...`.
 */
export function LiveDiplomaTab({ slug }: { slug: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const enabled = Boolean(slug);

  const detail = useQuery({ ...liveDiplomaQueries.detail(slug), enabled });
  const cohorts = useQuery({ ...liveDiplomaQueries.cohorts(slug), enabled });
  const waitlist = useQuery({ ...liveDiplomaQueries.waitlist(slug), enabled });

  const [selected, setSelected] = useState<string | null>(null);

  const diploma = detail.data;

  const [fields, setFields] = useState<LiveDiplomaWrite | null>(null);
  const current: LiveDiplomaWrite = fields ?? {
    slug,
    title: diploma?.title ?? "",
    price_usd: diploma ? Number(diploma.price_usd) : 0,
    status: (diploma?.status ?? "draft") as LiveDiplomaWrite["status"],
    seat_capacity: diploma?.seat_capacity ?? 0,
    short_description: diploma?.short_description ?? null,
    description: diploma?.description ?? null,
    timezone_name: diploma?.timezone_name ?? "Asia/Riyadh",
    session_count: diploma?.session_count ?? null,
    starts_at: diploma?.starts_at ?? null,
    brochure_url: diploma?.brochure_url ?? null,
    image_url: diploma?.image_url ?? null,
    tags: diploma?.tags ?? [],
    learning_outcomes: diploma?.learning_outcomes ?? [],
  };

  const patch = (next: Partial<LiveDiplomaWrite>) => setFields({ ...current, ...next });

  const saveDiploma = useMutation({
    mutationFn: () => updateLiveDiploma(slug, current),
    onSuccess: (result) => {
      setFields(null);
      queryClient.setQueryData(liveDiplomaKeys.detail(slug), result);
      queryClient.invalidateQueries({ queryKey: liveDiplomaKeys.all });
    },
  });

  if (!enabled) return <Empty text={t("لا يوجد رابط للدبلوم المباشر.", "This product has no live-diploma slug.")} />;
  if (detail.isLoading) return <Loading />;
  if (detail.error) return <ErrorAlert error={detail.error} />;
  if (!diploma) return <Empty text={t("لم يتم العثور على الدبلوم المباشر.", "Live diploma not found.")} />;

  const cohortList = cohorts.data ?? [];

  return (
    <div className="ma-stack" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        title={t("الدبلوم المباشر", "Live diploma")}
        actions={<Button kind="primary" label={t("حفظ", "Save")} disabled={saveDiploma.isPending} onClick={() => saveDiploma.mutate()} />}
      >
        <ErrorAlert error={saveDiploma.error} title={t("تعذّر الحفظ", "Couldn't save")} />
        <div className="ma-grid-2">
          <Field id="ld-title" label={t("العنوان", "Title")} value={current.title} onChange={(value) => patch({ title: value })} />
          <Field id="ld-price" label={t("السعر (USD)", "Price (USD)")} value={String(current.price_usd ?? 0)} onChange={(value) => patch({ price_usd: value })} />
          <Field
            id="ld-status"
            label={t("الحالة", "Status")}
            value={current.status ?? "draft"}
            onChange={(value) => patch({ status: value as LiveDiplomaWrite["status"] })}
            options={[
              ["draft", t("مسودة", "Draft")],
              ["published", t("منشور", "Published")],
              ["unpublished", t("غير منشور", "Unpublished")],
              ["archived", t("مؤرشف", "Archived")],
            ]}
          />
          <Field id="ld-tz" label={t("المنطقة الزمنية", "Timezone")} value={current.timezone_name ?? ""} onChange={(value) => patch({ timezone_name: value })} />
          <Field id="ld-brochure" label={t("رابط البروشور", "Brochure URL")} value={current.brochure_url ?? ""} onChange={(value) => patch({ brochure_url: value || null })} />
          <Field id="ld-image" label={t("رابط الصورة", "Image URL")} value={current.image_url ?? ""} onChange={(value) => patch({ image_url: value || null })} />
        </div>
        <Card title={t("معلومات", "Facts")} className="ma-section-gap">
          <Dl
            rows={[
              [t("المقاعد المتاحة", "Seats available"), String(diploma.seats_available)],
              [t("المقاعد المحجوزة", "Seats taken"), String(diploma.seats_taken)],
              [t("عدد الجلسات", "Sessions"), diploma.session_count != null ? String(diploma.session_count) : "—"],
            ]}
          />
        </Card>
      </Card>

      <CohortsCard slug={slug} cohorts={cohortList} selected={selected} onSelect={setSelected} />

      {selected ? <CohortDetail slug={slug} cohortId={selected} /> : null}

      <WaitlistCard slug={slug} rows={waitlist.data ?? []} cohorts={cohortList.map((c) => c.cohort_id)} loading={waitlist.isLoading} />
    </div>
  );
}

function CohortsCard({
  slug,
  cohorts,
  selected,
  onSelect,
}: {
  slug: string;
  cohorts: Cohort[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState({ number: "", starts: "", ends: "", weeks: "", seats: "" });

  const create = useMutation({
    mutationFn: () => {
      const body: CohortWrite = {
        cohort_number: Number(draft.number || cohorts.length + 1),
        status: "draft",
        starts_at: toIso(draft.starts),
        ends_at: toIso(draft.ends),
        timezone_name: "Asia/Riyadh",
        weeks_count: Number(draft.weeks || 1),
        seat_capacity: Number(draft.seats || 0),
      };
      return createCohort(slug, body);
    },
    onSuccess: () => {
      setDraft({ number: "", starts: "", ends: "", weeks: "", seats: "" });
      queryClient.invalidateQueries({ queryKey: liveDiplomaKeys.cohorts(slug) });
    },
  });

  const remove = useMutation({
    mutationFn: (cohortId: string) => deleteCohort(slug, cohortId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveDiplomaKeys.cohorts(slug) }),
  });

  const openClose = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CohortWrite["status"] }) => {
      const cohort = cohorts.find((c) => c.cohort_id === id);
      if (!cohort) throw new Error("Cohort not found");
      const body: CohortWrite = {
        cohort_number: cohort.cohort_number,
        title: cohort.title ?? null,
        status,
        starts_at: cohort.starts_at,
        ends_at: cohort.ends_at,
        enrollment_closes_at: cohort.enrollment_closes_at ?? null,
        timezone_name: cohort.timezone_name,
        weeks_count: cohort.weeks_count,
        seat_capacity: cohort.seat_capacity,
      };
      return updateCohort(slug, id, body);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveDiplomaKeys.cohorts(slug) }),
  });

  return (
    <Card title={t("الدفعات (Cohorts)", "Cohorts")}>
      <ErrorAlert error={create.error || remove.error || openClose.error} title={t("تعذّر تحديث الدفعات", "Couldn't update cohorts")} />
      {cohorts.length === 0 ? (
        <Empty text={t("لا دفعات.", "No cohorts yet.")} />
      ) : (
        <div className="ma-stack">
          {cohorts.map((cohort) => (
            <div key={cohort.cohort_id} className="ma-cell-flex" style={{ justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
              <button type="button" className="ma-link ma-link--plain" onClick={() => onSelect(selected === cohort.cohort_id ? null : cohort.cohort_id)}>
                <span className="ma-cell-main">
                  #{cohort.cohort_number} {cohort.title ?? ""}
                </span>
                <span className="ma-cell-sub">
                  <Badge def={{ label: { ar: cohort.status, en: cohort.status } }} />
                  {" · "}
                  {formatDateTime(cohort.starts_at)} → {formatDateTime(cohort.ends_at)}
                  {" · "}
                  {t("مقاعد", "seats")} {cohort.seats_taken}/{cohort.seat_capacity}
                </span>
              </button>
              <span className="ma-cell-flex" style={{ gap: 6 }}>
                {cohort.status === "draft" ? (
                  <Button sm label={t("فتح التسجيل", "Open")} onClick={() => openClose.mutate({ id: cohort.cohort_id, status: "open" })} />
                ) : cohort.status === "open" ? (
                  <Button sm label={t("إغلاق", "Close")} onClick={() => openClose.mutate({ id: cohort.cohort_id, status: "closed" })} />
                ) : null}
                <Button sm kind="danger" label={t("حذف", "Delete")} onClick={() => remove.mutate(cohort.cohort_id)} />
              </span>
            </div>
          ))}
        </div>
      )}

      <Card title={t("إضافة دفعة", "Add a cohort")} className="ma-section-gap">
        <div className="ma-grid-2">
          <Field id="c-num" label={t("الرقم", "Number")} value={draft.number} onChange={(v) => setDraft((d) => ({ ...d, number: v }))} />
          <Field id="c-weeks" label={t("عدد الأسابيع", "Weeks")} value={draft.weeks} onChange={(v) => setDraft((d) => ({ ...d, weeks: v }))} />
          <Field id="c-seats" label={t("المقاعد", "Seats")} value={draft.seats} onChange={(v) => setDraft((d) => ({ ...d, seats: v }))} />
          <Field id="c-starts" type="datetime-local" label={t("يبدأ", "Starts")} value={draft.starts} onChange={(v) => setDraft((d) => ({ ...d, starts: v }))} />
          <Field id="c-ends" type="datetime-local" label={t("ينتهي", "Ends")} value={draft.ends} onChange={(v) => setDraft((d) => ({ ...d, ends: v }))} />
        </div>
        <Button
          kind="primary"
          label={t("إضافة دفعة", "Add cohort")}
          disabled={create.isPending || !draft.starts || !draft.ends}
          onClick={() => create.mutate()}
        />
      </Card>
    </Card>
  );
}

function CohortDetail({ slug, cohortId }: { slug: string; cohortId: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const students = useQuery(liveDiplomaQueries.cohortStudents(slug, cohortId));
  const [session, setSession] = useState({ slot: "1", title: "", starts: "", ends: "", url: "" });

  const createSession = useMutation({
    mutationFn: () => {
      const body: SessionWrite = {
        slot_number: Number(session.slot || 1),
        title: session.title || t("جلسة", "Session"),
        starts_at: toIso(session.starts),
        ends_at: toIso(session.ends),
        meeting_url: session.url || null,
      };
      return createCohortSession(slug, cohortId, body);
    },
    onSuccess: () => {
      setSession({ slot: "1", title: "", starts: "", ends: "", url: "" });
      queryClient.invalidateQueries({ queryKey: liveDiplomaKeys.cohorts(slug) });
    },
  });

  const removeSession = useMutation({
    mutationFn: (sessionId: string) => deleteCohortSession(slug, cohortId, sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveDiplomaKeys.cohorts(slug) }),
  });

  const columns: Column<CohortStudent>[] = [
    { key: "name", header: t("الطالب", "Student"), cell: (row) => row.full_name ?? row.email },
    { key: "email", header: t("البريد", "Email"), cell: (row) => row.email },
    { key: "qty", header: t("العدد", "Qty"), align: "end", cell: (row) => <span className="ma-num">{row.quantity}</span> },
    { key: "status", header: t("الحالة", "Status"), cell: (row) => row.order_status },
    { key: "date", header: t("التاريخ", "Date"), cell: (row) => formatDateTime(row.placed_at ?? null) },
  ];

  const cohort = useQuery({ ...liveDiplomaQueries.cohorts(slug), enabled: true }).data?.find((c) => c.cohort_id === cohortId);

  return (
    <Card title={t(`الدفعة #${cohort?.cohort_number ?? ""}`, `Cohort #${cohort?.cohort_number ?? ""}`)}>
      <ErrorAlert error={createSession.error || removeSession.error} title={t("تعذّر تحديث الجلسات", "Couldn't update sessions")} />

      <Card title={t("الجلسات", "Sessions")}>
        {(cohort?.sessions ?? []).length === 0 ? (
          <Empty text={t("لا جلسات.", "No sessions.")} />
        ) : (
          <div className="ma-stack">
            {(cohort?.sessions ?? []).map((item) => (
              <div key={item.session_id} className="ma-cell-flex" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
                <span>
                  <span className="ma-cell-main">
                    #{item.slot_number} {item.title}
                  </span>
                  <span className="ma-cell-sub">
                    {formatDateTime(item.starts_at)} → {formatDateTime(item.ends_at)}
                  </span>
                </span>
                <Button sm kind="danger" label={t("حذف", "Delete")} onClick={() => removeSession.mutate(item.session_id)} />
              </div>
            ))}
          </div>
        )}
        <div className="ma-grid-2" style={{ marginTop: 12 }}>
          <Field id="s-slot" label={t("الرقم", "Slot")} value={session.slot} onChange={(v) => setSession((s) => ({ ...s, slot: v }))} />
          <Field id="s-title" label={t("العنوان", "Title")} value={session.title} onChange={(v) => setSession((s) => ({ ...s, title: v }))} />
          <Field id="s-starts" type="datetime-local" label={t("يبدأ", "Starts")} value={session.starts} onChange={(v) => setSession((s) => ({ ...s, starts: v }))} />
          <Field id="s-ends" type="datetime-local" label={t("ينتهي", "Ends")} value={session.ends} onChange={(v) => setSession((s) => ({ ...s, ends: v }))} />
          <Field id="s-url" label={t("رابط الاجتماع", "Meeting URL")} value={session.url} onChange={(v) => setSession((s) => ({ ...s, url: v }))} />
        </div>
        <Button kind="primary" label={t("إضافة جلسة", "Add session")} disabled={createSession.isPending || !session.starts || !session.ends} onClick={() => createSession.mutate()} />
      </Card>

      <Card title={t("الطلاب", "Students")} className="ma-section-gap">
        {students.isLoading ? <Loading /> : <DataTable rows={students.data ?? []} columns={columns} empty={t("لا طلاب.", "No students.")} />}
      </Card>
    </Card>
  );
}

function WaitlistCard({
  slug,
  rows,
  cohorts,
  loading,
}: {
  slug: string;
  rows: WaitlistRow[];
  cohorts: string[];
  loading: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "waiting" | "cancelled" }) => updateWaitlistEntry(slug, id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveDiplomaKeys.waitlist(slug) }),
  });

  const [notifyCohort, setNotifyCohort] = useState("");
  const notify = useMutation({
    mutationFn: () => notifyWaitlist(slug, notifyCohort),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: liveDiplomaKeys.waitlist(slug) }),
  });

  const columns: Column<WaitlistRow>[] = useMemo(
    () => [
      { key: "name", header: t("الاسم", "Name"), cell: (row) => row.full_name ?? row.email ?? row.customer_id.slice(0, 8) },
      { key: "email", header: t("البريد", "Email"), cell: (row) => row.email ?? "—" },
      { key: "status", header: t("الحالة", "Status"), cell: (row) => <Badge def={{ label: { ar: row.status, en: row.status } }} /> },
      { key: "joined", header: t("التاريخ", "Joined"), cell: (row) => formatDateTime(row.joined_at) },
      {
        key: "actions",
        header: "",
        align: "end",
        cell: (row) => (
          <span className="ma-cell-flex" style={{ gap: 6 }}>
            {row.status !== "cancelled" ? (
              <Button sm label={t("إلغاء", "Cancel")} onClick={() => setStatus.mutate({ id: row.waitlist_id, status: "cancelled" })} />
            ) : (
              <Button sm label={t("إعادة", "Restore")} onClick={() => setStatus.mutate({ id: row.waitlist_id, status: "waiting" })} />
            )}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, slug],
  );

  return (
    <Card title={t("قائمة الانتظار", "Waitlist")}>
      <ErrorAlert error={setStatus.error || notify.error} title={t("تعذّر تحديث قائمة الانتظار", "Couldn't update the waitlist")} />
      {loading ? <Loading /> : <DataTable rows={rows} columns={columns} empty={t("قائمة الانتظار فارغة.", "The waitlist is empty.")} />}

      {cohorts.length > 0 ? (
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ minWidth: 220 }}>
            <Field
              id="w-notify"
              label={t("إشعار قائمة الانتظار لدفعة مفتوحة", "Notify the waitlist for an open cohort")}
              value={notifyCohort}
              onChange={setNotifyCohort}
              options={[["", t("اختر…", "Choose…")], ...cohorts.map((id): [string, string] => [id, id.slice(0, 8)])] as [string, string][]}
            />
          </div>
          <Button label={t("إشعار", "Notify")} disabled={!notifyCohort || notify.isPending} onClick={() => notify.mutate()} />
        </div>
      ) : null}
      {notify.data ? <Alert kind="success" title={t("تم إشعار قائمة الانتظار.", "The waitlist was notified.")} /> : null}
    </Card>
  );
}

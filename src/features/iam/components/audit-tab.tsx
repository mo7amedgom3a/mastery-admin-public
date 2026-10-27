import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  accessQueries,
  type AdminTrace,
  type AuditLog,
  type IamAdminUser,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Badge, Button, Card, Empty, Kpi } from "@/components/ui/kit";
import { DataTable, type Column } from "@/components/ui/data-table";
import { InfoHint } from "@/components/ui/info-hint";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/primitives";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";

const LIMIT = 25;

export function AuditTab() {
  const t = useT();
  const [params] = useSearchParams();
  const [groupId, setGroupId] = useState(params.get("team") ?? "");
  const [adminId, setAdminId] = useState(params.get("actor") ?? "");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const groups = useQuery(accessQueries.groups({ limit: 200 }));
  const directory = useQuery(accessQueries.directory());
  const audit = useQuery(
    accessQueries.audit({
      group_id: groupId || undefined,
      actor_id: adminId || undefined,
      search: search || undefined,
      limit: LIMIT,
      offset,
    }),
  );
  const trace = useQuery({ ...accessQueries.trace(adminId), enabled: Boolean(adminId) });

  const actors = new Map((directory.data ?? []).map((user) => [user.admin_user_id, user]));
  const actorLabel = (row: AuditLog) => {
    const actor = row.actor_id ? actors.get(row.actor_id) : undefined;
    return actor?.full_name || actor?.email || (row.actor_id ? shortId(row.actor_id) : row.actor_type);
  };

  const columns: Column<AuditLog>[] = [
    {
      key: "when",
      header: t("الوقت", "When"),
      width: "120px",
      cell: (row) => <span className="ma-num" dir="ltr">{formatDate(row.created_at)}</span>,
    },
    {
      key: "actor",
      header: t("الفاعل", "Actor"),
      width: "170px",
      cell: (row) => (
        <span>
          <span className="ma-cell-main ma-truncate" title={actorLabel(row)}>{actorLabel(row)}</span>
          <span className="ma-cell-sub" dir="ltr">{row.actor_id ? shortId(row.actor_id) : row.actor_type}</span>
        </span>
      ),
    },
    {
      key: "action",
      header: t("الإجراء", "Action"),
      width: "300px",
      cell: (row) => <span className="ma-cell-main ma-truncate" dir="ltr" title={row.action}>{row.action}</span>,
    },
    {
      key: "entity",
      header: t("الكيان", "Entity"),
      width: "140px",
      cell: (row) => (
        <span>
          <span className="ma-cell-main ma-truncate">{row.entity_type}</span>
          <span className="ma-cell-sub" dir="ltr">{shortId(row.entity_id)}</span>
        </span>
      ),
    },
    {
      key: "request",
      header: t("الطلب", "Request"),
      width: "220px",
      cell: (row) => (
        <span>
          <span className="ma-cell-sub ma-truncate" dir="ltr" title={`${row.method ?? ""} ${row.path ?? ""}`}>
            {row.method ?? "—"} {row.path ?? ""}
          </span>
          <span className="ma-cell-sub">
            {row.status_code != null ? <Badge def={statusBadge(row.status_code)} /> : null}{" "}
            {row.duration_ms != null ? `${row.duration_ms} ms` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "details",
      header: "",
      width: "110px",
      align: "end",
      cell: (row) => <Button sm label={t("التفاصيل", "Details")} onClick={() => setSelected(row)} />,
    },
  ];

  return (
    <div className="ma-stack ma-section-gap">
      <div className="ma-cols ma-cols--2">
        <Kpi label={t("سجلات مطابقة", "Matching rows")} value={audit.data?.total ?? 0} icon="shield" field="var(--purple)" />
        <Kpi label={t("إجراءات المشرف المحدد", "Selected admin's actions")} value={trace.data?.total_actions ?? 0} icon="users" field="var(--teal)" />
      </div>

      <Card
        title={
          <span className="ma-row" style={{ justifyContent: "flex-start", gap: 6 }}>
            {t("الفلاتر", "Filters")}
            <InfoHint label={t("فلاتر التدقيق", "Audit filters")} title={t("فلاتر التدقيق", "Audit filters")}>
              {t(
                "صفّي حسب الفريق أو المشرف أو ابحث في الإجراء والمسار. اختيار مشرف يعرض أيضًا جلساته وملخص وصوله.",
                "Filter by team, admin, or free text over the action and path. Selecting an admin also shows their sessions and access summary.",
              )}
            </InfoHint>
          </span>
        }
      >
        <div className="ma-filter-grid">
          <SelectField
            label={t("الفريق", "Team")}
            value={groupId}
            onChange={(value) => {
              setGroupId(value);
              setOffset(0);
            }}
            options={[
              { value: "", label: t("كل الفرق", "All teams") },
              ...(groups.data?.items ?? []).map((group) => ({ value: group.group_id, label: group.name })),
            ]}
            showLabel
            fullWidth
          />
          <SelectField
            label={t("المشرف", "Admin")}
            value={adminId}
            onChange={(value) => {
              setAdminId(value);
              setOffset(0);
            }}
            options={[
              { value: "", label: t("كل المشرفين", "All admins") },
              ...(directory.data ?? []).map((item) => ({
                value: item.admin_user_id,
                label: item.full_name || item.email,
              })),
            ]}
            showLabel
            fullWidth
          />
          <div className="ma-field">
            <span className="ma-label">{t("بحث", "Search")}</span>
            <SearchBox
              placeholder={t("ابحث في الإجراء أو المسار…", "Search action or path…")}
              value={search}
              onChange={(value) => {
                setSearch(value);
                setOffset(0);
              }}
            />
          </div>
        </div>
      </Card>

      {adminId ? <TracePanel trace={trace.data} loading={trace.isLoading} /> : null}

      <Card
        flush
        title={
          <span className="ma-row" style={{ justifyContent: "flex-start", gap: 6 }}>
            {t("سجل الإجراءات", "Action trail")}
            <InfoHint label={t("تفاصيل السجل", "Audit details")} title={t("تفاصيل السجل", "Audit details")}>
              {t(
                "كل صف يحتوي الفاعل، الحمولة قبل/بعد، ونتيجة الطلب. اضغط التفاصيل لعرض الحمولة كاملة وسياق الطلب.",
                "Each row carries the actor, the before/after payload and the request outcome. Open Details for the full payload and request context.",
              )}
            </InfoHint>
          </span>
        }
      >
        <DataTable
          className="ma-table--fixed"
          columns={columns}
          rows={audit.data?.items ?? []}
          loading={audit.isLoading}
          error={audit.error}
          empty={t("لا سجلات مطابقة.", "No matching rows.")}
          footer={
            audit.data ? (
              <Pagination
                total={audit.data.total}
                limit={audit.data.limit}
                offset={audit.data.offset}
                onPage={setOffset}
              />
            ) : null
          }
        />
      </Card>

      <AuditDetailModal
        row={selected}
        actor={selected?.actor_id ? actors.get(selected.actor_id) : undefined}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function TracePanel({ trace, loading }: { trace?: AdminTrace; loading: boolean }) {
  const t = useT();
  if (loading) return <Card>{t("جارٍ تحميل التتبع…", "Loading trace…")}</Card>;
  if (!trace) return null;

  return (
    <Card
      title={
        <span className="ma-row" style={{ justifyContent: "flex-start", gap: 6 }}>
          {t("تتبع", "Trace")} · {trace.admin.full_name || trace.admin.email}
          <InfoHint label={t("ملخص الوصول", "Access summary")} title={t("ملخص الوصول", "Access summary")}>
            {t(
              "الفريق والصلاحيات الفعلية لهذا المشرف، مع شروط السجلات team/own وجلسات الدخول.",
              "This admin's teams, effective scopes with team/own conditions, and recent sign-in sessions.",
            )}
          </InfoHint>
        </span>
      }
    >
      <div className="ma-cols ma-cols--2">
        <section>
          <h3 className="ma-subhead">{t("ملخص الوصول", "Access summary")}</h3>
          <p className="ma-muted">
            {t("الفرق", "Teams")}: {trace.admin.groups.length ? trace.admin.groups.join(", ") : "—"}
          </p>
          <p className="ma-muted">
            {t("الصلاحيات", "Scopes")}: {trace.admin.scopes.length}
            {trace.admin.scopes.includes("*") ? ` (${t("كل الصلاحيات", "all")})` : ""}
          </p>
          <div className="ma-stack">
            {Object.entries(trace.admin.resource_conditions).map(([scope, condition]) => (
              <code key={scope} dir="ltr">{scope} → {condition}</code>
            ))}
          </div>
        </section>
        <section>
          <h3 className="ma-subhead">{t("الجلسات", "Sessions")}</h3>
          <div className="ma-stack">
            {trace.sessions.slice(0, 8).map((session) => (
              <div key={session.session_id} className="ma-row">
                <span>
                  <span className="ma-cell-main" dir="ltr">{shortId(session.session_id)}</span>
                  <span className="ma-cell-sub" dir="ltr">{formatDate(session.created_at)}</span>
                </span>
                <Badge
                  def={
                    session.status === "active"
                      ? { label: { ar: "نشطة", en: "Active" }, tone: "success" }
                      : { label: { ar: session.status, en: session.status }, tone: "neutral" }
                  }
                />
              </div>
            ))}
            {!trace.sessions.length ? <Empty icon="key" text={t("لا جلسات.", "No sessions.")} /> : null}
          </div>
        </section>
      </div>
    </Card>
  );
}

function AuditDetailModal({
  row,
  actor,
  onClose,
}: {
  row: AuditLog | null;
  actor?: IamAdminUser;
  onClose: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  if (!row) return null;

  const isApiTrace = row.entity_type === "admin_api";

  return (
    <Modal
      open={Boolean(row)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      size="xl"
      title={
        <span className="ma-row" style={{ justifyContent: "flex-start", gap: 8, flexWrap: "wrap" }}>
          <span dir="ltr">{row.action}</span>
          {row.status_code != null ? <Badge def={statusBadge(row.status_code)} /> : null}
          {isApiTrace ? <Badge def={{ label: { ar: "طلب API", en: "API trace" }, tone: "neutral" }} /> : null}
        </span>
      }
      description={formatDate(row.created_at)}
      footer={
        <>
          {actor ? (
            <Button
              label={t("فتح صفحة المستخدم", "Open user page")}
              onClick={() => {
                onClose();
                navigate(`/access/users/${actor.admin_user_id}`);
              }}
            />
          ) : null}
          <Button kind="primary" label={t("إغلاق", "Close")} onClick={onClose} />
        </>
      }
    >
      <div className="ma-stack">
        <div className="ma-cols ma-cols--2">
          <Card title={t("الفاعل", "Actor")}>
            {actor ? (
              <div className="ma-stack">
                <div className="ma-row">
                  <span>
                    <span className="ma-cell-main">{actor.full_name || actor.email}</span>
                    <span className="ma-cell-sub" dir="ltr">{actor.email}</span>
                  </span>
                  <Badge
                    def={
                      actor.status === "active"
                        ? { label: { ar: "نشط", en: "Active" }, tone: "success" }
                        : { label: { ar: "موقوف", en: "Suspended" }, tone: "warning" }
                    }
                  />
                </div>
                <p className="ma-muted">{t("الفرق", "Teams")}: {actor.groups.length ? actor.groups.join(", ") : "—"}</p>
                <p className="ma-muted">{t("الصلاحيات", "Scopes")}: {actor.scopes.length}</p>
              </div>
            ) : (
              <p className="ma-muted" dir="ltr">{row.actor_type} · {row.actor_id ?? "—"}</p>
            )}
          </Card>

          <Card title={t("سياق الطلب", "Request context")}>
            <dl className="ma-dl">
              <dt>request_id</dt><dd dir="ltr">{row.request_id ?? "—"}</dd>
              <dt>method</dt><dd dir="ltr">{row.method ?? "—"}</dd>
              <dt>path</dt><dd dir="ltr">{row.path ?? "—"}</dd>
              <dt>status_code</dt><dd dir="ltr">{row.status_code ?? "—"}</dd>
              <dt>duration_ms</dt><dd dir="ltr">{row.duration_ms ?? "—"}</dd>
              <dt>ip_hash</dt><dd dir="ltr">{row.ip_hash ?? "—"}</dd>
              <dt>fingerprint</dt><dd dir="ltr">{row.fingerprint_hash ?? "—"}</dd>
              <dt>entity</dt><dd dir="ltr">{row.entity_type} · {row.entity_id}</dd>
            </dl>
          </Card>
        </div>

        <Card
          title={
            <span className="ma-row" style={{ justifyContent: "flex-start", gap: 6 }}>
              {t("الحمولة والنتيجة", "Payload & result")}
              <InfoHint label={t("الحمولة", "Payload")} title={t("الحمولة", "Payload")}>
                {t(
                  "before/after هي الحالة قبل وبعد الإجراء. لصفوف admin_api تُحفظ حالة الطلب (method/path/status/duration) بدل جسم الاستجابة.",
                  "before/after is the state around the action. For admin_api rows the stored value is the request context (method/path/status/duration), not the HTTP response body.",
                )}
              </InfoHint>
            </span>
          }
        >
          <div className="ma-cols ma-cols--2">
            <div>
              <h3 className="ma-subhead">{t("قبل / الحمولة", "Before / payload")}</h3>
              <pre className="ma-json" dir="ltr">{pretty(row.before_state_json)}</pre>
            </div>
            <div>
              <h3 className="ma-subhead">{t("بعد / النتيجة", "After / result")}</h3>
              <pre className="ma-json" dir="ltr">{pretty(row.after_state_json)}</pre>
            </div>
          </div>
        </Card>
      </div>
    </Modal>
  );
}

function pretty(value?: string | null): string {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function shortId(value: string): string {
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function statusBadge(status: number) {
  if (status >= 500) return { label: { ar: String(status), en: String(status) }, tone: "danger" as const };
  if (status >= 400) return { label: { ar: String(status), en: String(status) }, tone: "warning" as const };
  return { label: { ar: String(status), en: String(status) }, tone: "success" as const };
}

import { useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import {
  changeEntitlementStatus,
  entitlementAdminKeys,
  extendEntitlement,
  getAdminEntitlement,
  type AdminEntitlement,
  type EntitlementStatusAction,
} from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { entitlementStatusBadge } from "@/lib/status";
import { Badge, Button, Dl, Empty, ErrorAlert, Field, FormActions, Loading } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { DAY_MS, daysLeft, useRefreshEntitlements, useSourceLabel } from "@/features/entitlements/components/entitlement-model";

/* Dialogs for one entitlement: extend, suspend / reinstate / revoke (with a reason) and the detail view. */

const PRESETS = [30, 90, 365] as const;

export function ExtendModal({ row, onClose }: { row: AdminEntitlement; onClose: () => void }) {
  const t = useT();
  const refresh = useRefreshEntitlements();
  const [choice, setChoice] = useState<string>("30");
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  // One key per dialog: a double submit or a retry after a network error extends only once.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [now] = useState(() => Date.now());
  const lifetime = choice === "lifetime";
  const days = choice === "custom" ? Number.parseInt(custom, 10) : Number.parseInt(choice, 10);
  const valid = reason.trim().length >= 3 && (lifetime || (Number.isFinite(days) && days >= 1 && days <= 3650));
  const base = Math.max(now, row.expires_at ? new Date(row.expires_at).getTime() : now);
  const preview = lifetime || !Number.isFinite(days) ? null : new Date(base + days * DAY_MS).toISOString();

  const extend = useMutation({
    mutationFn: () =>
      extendEntitlement(row.entitlement_id, lifetime ? { lifetime: true, reason: reason.trim() } : { days, lifetime: false, reason: reason.trim() }, idempotencyKey),
    onSuccess: () => {
      refresh();
      toast.success(t("تم تمديد الوصول", "Access extended"));
      onClose();
    },
  });

  return (
    <Modal open onOpenChange={(value) => !value && onClose()} title={t("تمديد الوصول", "Extend access")}
      description={row.product_title ?? row.product_slug ?? undefined}
      footer={
        <FormActions>
          <Button kind="primary" icon="check" disabled={!valid || extend.isPending}
            label={extend.isPending ? t("جارٍ التمديد…", "Extending…") : t("تمديد", "Extend")} onClick={() => extend.mutate()} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
        </FormActions>
      }>
      <div className="grid gap-3">
        <div className="ma-cell-flex" role="radiogroup" style={{ gap: "8px", flexWrap: "wrap" }}>
          {[...PRESETS.map(String), "lifetime", "custom"].map((value) => (
            <label key={value} className="ma-cell-flex" style={{ gap: "6px" }}>
              <input type="radio" name="extend-days" checked={choice === value} onChange={() => setChoice(value)} />
              {value === "lifetime" ? t("مدى الحياة", "Lifetime") : value === "custom" ? t("مدة أخرى", "Other") : t(`${value} يوماً`, `${value} days`)}
            </label>
          ))}
        </div>
        {choice === "custom" ? (
          <Field id="extend-custom" type="number" label={t("عدد الأيام", "Days")} value={custom} onChange={setCustom} hint={t("من 1 إلى 3650.", "1 to 3650.")} />
        ) : null}
        <Dl
          rows={[
            [t("الانتهاء الحالي", "Current expiry"), formatDate(row.expires_at)],
            [t("الانتهاء الجديد", "New expiry"), lifetime ? t("مدى الحياة", "Lifetime") : formatDate(preview)],
          ]}
        />
        <Field id="extend-reason" type="textarea" rows={2} required label={t("السبب", "Reason")} value={reason} onChange={setReason}
          hint={t("يظهر في سجل الوصول، مثل «تعويض عن انقطاع الخدمة».", "Shown in the access history, e.g. “compensation for an outage”.")} />
        <ErrorAlert error={extend.error} />
      </div>
    </Modal>
  );
}

export function StatusModal({ row, action, onClose }: { row: AdminEntitlement; action: EntitlementStatusAction; onClose: () => void }) {
  const t = useT();
  const refresh = useRefreshEntitlements();
  const [reason, setReason] = useState("");
  const left = daysLeft(row);
  const copy = {
    suspend: {
      title: t("إيقاف الوصول مؤقتاً؟", "Suspend this access?"),
      body: t(
        `يفقد العميل الوصول حتى الاستئناف. تُجمَّد الأيام المتبقية (${left ?? "مدى الحياة"}) وتُعاد عند الاستئناف.`,
        `The customer loses access until it is reinstated. The days left (${left ?? "lifetime"}) are frozen and given back on reinstatement.`,
      ),
      confirm: t("إيقاف", "Suspend"),
      done: t("تم إيقاف الوصول", "Access suspended"),
    },
    reinstate: {
      title: t("استئناف الوصول؟", "Reinstate this access?"),
      body: t(
        `يعود الوصول فوراً لمدة ${row.suspended_remaining_days ?? "مدى الحياة"} يوماً من اليوم، ويُعاد التسجيل في منصة التعلم.`,
        `Access comes back now for ${row.suspended_remaining_days ?? "lifetime"}${row.suspended_remaining_days != null ? " days" : ""}, and the LMS enrollment is restored.`,
      ),
      confirm: t("استئناف", "Reinstate"),
      done: t("تم استئناف الوصول", "Access reinstated"),
    },
    revoke: {
      title: t("سحب الوصول نهائياً؟", "Revoke this access for good?"),
      body: t(
        "لا يمكن التراجع عن السحب ولا يُسترد المبلغ تلقائياً. استخدم الإيقاف المؤقت إذا كان الأمر قابلاً للمراجعة.",
        "A revoke can't be undone and does not refund the order. Use suspend if the case may be reviewed.",
      ),
      confirm: t("سحب نهائي", "Revoke"),
      done: t("تم سحب الوصول", "Access revoked"),
    },
  }[action];

  const mutation = useMutation({
    mutationFn: () => changeEntitlementStatus(row.entitlement_id, action, reason.trim()),
    onSuccess: (result) => {
      refresh();
      toast.success(result.changed ? copy.done : t("لا تغيير: الإجراء مطبّق مسبقاً", "No change: already applied"));
      onClose();
    },
  });

  return (
    <Modal open onOpenChange={(value) => !value && onClose()} title={copy.title} description={row.product_title ?? undefined}
      footer={
        <FormActions>
          <Button kind={action === "revoke" ? "danger" : "primary"} disabled={reason.trim().length < 3 || mutation.isPending}
            label={copy.confirm} onClick={() => mutation.mutate()} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
        </FormActions>
      }>
      <div className="grid gap-3">
        <p className="ma-help" style={{ margin: 0 }}>{copy.body}</p>
        <Field id={`${action}-reason`} type="textarea" rows={2} required label={t("السبب", "Reason")} value={reason} onChange={setReason} />
        <ErrorAlert error={mutation.error} />
      </div>
    </Modal>
  );
}

export function EntitlementDetailModal({ row, onClose }: { row: AdminEntitlement; onClose: () => void }) {
  const t = useT();
  const sourceLabel = useSourceLabel();
  const detail = useQuery({
    queryKey: entitlementAdminKeys.detail(row.entitlement_id),
    queryFn: () => getAdminEntitlement(row.entitlement_id),
  });
  const data = detail.data;
  return (
    <Modal open onOpenChange={(value) => !value && onClose()} size="lg" title={row.product_title ?? t("الوصول", "Access")}
      description={row.customer_email ?? undefined}>
      {detail.isLoading ? <Loading /> : null}
      <ErrorAlert error={detail.error} />
      {data ? (
        <div className="grid gap-4">
          <Dl
            rows={[
              [t("الحالة", "Status"), <Badge key="s" def={entitlementStatusBadge(data.status)} />],
              [t("المصدر", "Source"), sourceLabel(data.source_type)],
              [t("البداية", "Starts"), formatDateTime(data.starts_at)],
              [t("الانتهاء", "Expires"), data.expires_at ? formatDateTime(data.expires_at) : t("مدى الحياة", "Lifetime")],
              ...(data.status === "suspended"
                ? ([[t("أيام مجمّدة", "Frozen days"), data.suspended_remaining_days ?? t("مدى الحياة", "Lifetime")]] as [ReactNode, ReactNode][])
                : []),
              ...(data.status_reason ? ([[t("سبب آخر تغيير", "Last change reason"), data.status_reason]] as [ReactNode, ReactNode][]) : []),
              [t("منصة التعلم", "LMS"), data.fulfillment_status ?? "—"],
            ]}
          />
          <section>
            <h3 className="ma-card-title">{t("التمديدات", "Extensions")}</h3>
            {data.extensions.length === 0 ? <Empty text={t("لا تمديدات.", "No extensions.")} /> : (
              <ul className="grid gap-1" style={{ margin: 0, paddingInlineStart: "1rem" }}>
                {data.extensions.map((ext) => (
                  <li key={ext.entitlement_extension_id}>
                    {formatDateTime(ext.created_at)} · {ext.lifetime ? t("مدى الحياة", "Lifetime") : t(`+${ext.extended_days} يوماً`, `+${ext.extended_days} days`)} ·{" "}
                    {ext.source === "admin" ? t("من الإدارة", "by admin") : t("مدفوع", "paid")}
                    {ext.reason ? ` — ${ext.reason}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="ma-card-title">{t("سجل الحالة", "Status history")}</h3>
            {data.events.length === 0 ? <Empty text={t("لا تغييرات من الإدارة.", "No admin changes.")} /> : (
              <ul className="grid gap-1" style={{ margin: 0, paddingInlineStart: "1rem" }}>
                {data.events.map((event, index) => (
                  <li key={`${event.created_at}-${index}`}>
                    {formatDateTime(event.created_at)} · <bdi>{event.action.replace("entitlement.", "")}</bdi>
                    {typeof event.after?.reason === "string" ? ` — ${event.after.reason}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </Modal>
  );
}

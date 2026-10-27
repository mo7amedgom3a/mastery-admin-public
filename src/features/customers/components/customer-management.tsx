import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addCustomerNote,
  customerAdminKeys,
  customersKeys,
  deleteCustomerNote,
  getCustomerAvatar,
  grantCustomerAccess,
  listCustomerGrantOptions,
  listCustomerGrants,
  listCustomerHistory,
  listCustomerNotes,
  revokeCustomerGrant,
  uploadCustomerAvatar,
  type CustomerGrant,
  type CustomerGrantOption,
} from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { productHref } from "@/lib/refs";
import { useCan } from "@/lib/permissions";
import { initialsOf } from "@/lib/status";
import { AppLink } from "@/components/ui/app-link";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, Badge, Button, Card, Empty, ErrorAlert, Field, FormActions } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { SearchBox } from "@/components/ui/paged-list";
import { SelectField } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";

/*
 * Customer management cards (B2C customers): profile photo, access given by admins, internal notes and the
 * history of admin actions. Every write is audited by the API and shows up in the history card.
 */

function useKindLabel() {
  const t = useT();
  return (kind: string) =>
    ({ course: t("دورة", "Course"), diploma: t("دبلوم", "Diploma"), package: t("باقة", "Package"), bundle: t("حزمة", "Bundle") })[kind] ?? kind;
}

function useRefreshCustomer(customerRef: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: customerAdminKeys.history(customerRef) });
    queryClient.invalidateQueries({ queryKey: customersKeys.customer360(customerRef) });
  };
}

export function CustomerAvatarCard({ customerRef, name }: { customerRef: string; name: string }) {
  const t = useT();
  const canWrite = useCan("customers.write");
  const queryClient = useQueryClient();
  const refresh = useRefreshCustomer(customerRef);
  const input = useRef<HTMLInputElement>(null);
  const avatar = useQuery({ queryKey: customerAdminKeys.avatar(customerRef), queryFn: () => getCustomerAvatar(customerRef) });
  const upload = useMutation({
    mutationFn: (file: File) => uploadCustomerAvatar(customerRef, file),
    onSuccess: (result) => {
      queryClient.setQueryData(customerAdminKeys.avatar(customerRef), result);
      refresh();
      toast.success(t("تم تحديث الصورة", "Photo updated"));
    },
  });
  return (
    <Card title={t("الصورة الشخصية", "Profile photo")}>
      <div className="ma-cell-flex" style={{ gap: "var(--space-4)" }}>
        <Avatar initials={initialsOf(name)} src={avatar.data?.avatar_url} color="var(--teal)" alt={name} lg />
        <div className="grid gap-2">
          <span className="ma-help">{t("JPEG أو PNG أو WebP، حتى 5 ميجابايت.", "JPEG, PNG or WebP, up to 5 MB.")}</span>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) upload.mutate(file);
            }}
          />
          {canWrite ? <Button sm icon="upload" disabled={upload.isPending} label={upload.isPending ? t("جارٍ الرفع…", "Uploading…") : t("رفع صورة", "Upload photo")} onClick={() => input.current?.click()} /> : null}
        </div>
      </div>
      <ErrorAlert error={avatar.error ?? upload.error} title={t("تعذّر تحميل الصورة أو رفعها", "Couldn't load or upload the photo")} />
    </Card>
  );
}

const grantStatus = (status: string) =>
  status === "active"
    ? ({ label: { ar: "نشط", en: "Active" }, tone: "success" } as const)
    : status === "expired"
      ? ({ label: { ar: "منتهٍ", en: "Expired" }, tone: "neutral" } as const)
      : ({ label: { ar: "مسحوب", en: "Revoked" }, tone: "warning" } as const);

/** Access given without payment (zero-total admin orders): grant a product, or revoke a grant. */
export function CustomerGrantsCard({ customerRef }: { customerRef: string }) {
  const t = useT();
  const canWrite = useCan("customers.write");
  const kindLabel = useKindLabel();
  const queryClient = useQueryClient();
  const refresh = useRefreshCustomer(customerRef);
  const grants = useQuery({ queryKey: customerAdminKeys.grants(customerRef), queryFn: () => listCustomerGrants(customerRef) });
  const [granting, setGranting] = useState(false);
  const [revoking, setRevoking] = useState<CustomerGrant | null>(null);
  const settle = (rows: CustomerGrant[]) => {
    queryClient.setQueryData(customerAdminKeys.grants(customerRef), rows);
    refresh();
  };
  const revoke = useMutation({
    mutationFn: (grant: CustomerGrant) => revokeCustomerGrant(customerRef, grant.order_id),
    onSuccess: (rows) => {
      settle(rows);
      setRevoking(null);
      toast.success(t("تم سحب الوصول", "Access revoked"));
    },
  });

  return (
    <Card
      title={t("وصول ممنوح من الإدارة", "Access given by admins")}
      className="ma-section-gap"
      actions={canWrite ? <Button kind="primary" icon="plus" label={t("منح وصول", "Grant access")} onClick={() => setGranting(true)} /> : undefined}
    >
      <ErrorAlert error={grants.error ?? revoke.error} />
      <DataTable
        rows={grants.data ?? []}
        loading={grants.isLoading}
        empty={t("لم يُمنح أي وصول يدوياً.", "No access given manually.")}
        columns={[
          {
            key: "product",
            header: t("المنتج", "Product"),
            cell: (row) => (
              <AppLink className="ma-link ma-link--plain" to={productHref(`b2c:${row.product_id}`)}>
                <span className="ma-cell-main">{row.title || row.slug}</span>
                <span className="ma-cell-sub">{kindLabel(row.product_type)}</span>
              </AppLink>
            ),
          },
          { key: "reason", header: t("السبب", "Reason"), cell: (row) => <span className="ma-cell-sub">{row.reason || "—"}</span> },
          { key: "by", header: t("بواسطة", "By"), cell: (row) => row.granted_by || "—" },
          { key: "at", header: t("التاريخ", "Date"), cell: (row) => formatDateTime(row.granted_at) },
          { key: "status", header: t("الحالة", "Status"), cell: (row) => <Badge def={grantStatus(row.status)} /> },
          {
            key: "actions",
            header: "",
            align: "end",
            cell: (row) =>
              canWrite && row.status === "active" ? <Button sm kind="ghost" icon="trash" label={t("سحب", "Revoke")} onClick={() => setRevoking(row)} /> : null,
          },
        ]}
      />
      {granting ? <GrantModal customerRef={customerRef} onClose={() => setGranting(false)} onGranted={settle} /> : null}
      <ConfirmModal
        open={revoking !== null}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={t("سحب الوصول؟", "Revoke this access?")}
        message={revoking?.title ?? revoking?.slug ?? ""}
        description={t("يفقد العميل الوصول فوراً (ومحتويات الحزمة إن وُجدت)، ويُلغى تسجيله في منصة التعلم.", "The customer loses access at once (bundle members included) and is unenrolled from the LMS.")}
        confirmLabel={t("سحب", "Revoke")}
        loading={revoke.isPending}
        onConfirm={() => revoking && revoke.mutate(revoking)}
      />
    </Card>
  );
}

function GrantModal({ customerRef, onClose, onGranted }: { customerRef: string; onClose: () => void; onGranted: (rows: CustomerGrant[]) => void }) {
  const t = useT();
  const kindLabel = useKindLabel();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [picked, setPicked] = useState<CustomerGrantOption | null>(null);
  const [reason, setReason] = useState("");
  const params = { query: query.trim() || undefined, product_type: (type || undefined) as "course" | "diploma" | "package" | "bundle" | undefined };
  const options = useQuery({
    queryKey: customerAdminKeys.grantOptions(customerRef, params),
    queryFn: () => listCustomerGrantOptions(customerRef, params),
  });
  const grant = useMutation({
    mutationFn: () => grantCustomerAccess(customerRef, picked!.product_id, reason.trim()),
    onSuccess: (rows) => {
      onGranted(rows);
      toast.success(t("تم منح الوصول", "Access granted"));
      onClose();
    },
  });

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} size="lg" title={t("منح وصول بدون دفع", "Grant access without payment")}
      footer={
        <FormActions>
          <Button kind="primary" icon="check" disabled={!picked || reason.trim().length < 3 || grant.isPending}
            label={grant.isPending ? t("جارٍ المنح…", "Granting…") : t("منح الوصول", "Grant access")} onClick={() => grant.mutate()} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
        </FormActions>
      }>
      <div className="grid gap-3">
        <div className="ma-cell-flex" style={{ gap: "var(--space-3)", flexWrap: "wrap" }}>
          <SearchBox placeholder={t("ابحث بالعنوان أو الرابط…", "Search title or slug…")} value={query} onChange={setQuery} />
          <SelectField label={t("النوع", "Type")} value={type} onChange={setType}
            options={[{ value: "", label: t("كل الأنواع", "All types") }, ...["course", "diploma", "package", "bundle"].map((kind) => ({ value: kind, label: kindLabel(kind) }))]} />
        </div>
        <ErrorAlert error={options.error ?? grant.error} />
        {options.data?.length === 0 ? <Empty text={t("لا منتجات منشورة مطابقة.", "No matching published products.")} /> : null}
        <ul className="grid gap-1" style={{ margin: 0, padding: 0, listStyle: "none", maxHeight: 280, overflowY: "auto" }}>
          {options.data?.map((option) => (
            <li key={option.product_id}>
              <label className="ma-cell-flex" style={{ gap: "8px", padding: "6px 8px", borderRadius: "var(--radius-soft)", background: picked?.product_id === option.product_id ? "var(--surface-alt)" : undefined, opacity: option.owned ? 0.55 : 1 }}>
                <input type="radio" name="grant-product" disabled={option.owned} checked={picked?.product_id === option.product_id} onChange={() => setPicked(option)} />
                <span className="ma-cell-main">{option.title || option.slug}</span>
                <span className="ma-cell-sub">{kindLabel(option.product_type)}{option.owned ? t(" · لديه وصول", " · already has access") : ""}</span>
              </label>
            </li>
          ))}
        </ul>
        <Field id="grant-reason" type="textarea" rows={2} required label={t("السبب", "Reason")} value={reason} onChange={setReason}
          hint={t("يُحفظ مع الطلب ويظهر في السجل، مثل «تعويض عن مشكلة تقنية».", "Kept on the order and in the history, e.g. “compensation for a technical issue”.")} />
      </div>
    </Modal>
  );
}

export function CustomerNotesCard({ customerRef }: { customerRef: string }) {
  const t = useT();
  const canWrite = useCan("customers.write");
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const notes = useQuery({ queryKey: customerAdminKeys.notes(customerRef), queryFn: () => listCustomerNotes(customerRef) });
  const settle = (rows: Awaited<ReturnType<typeof listCustomerNotes>>) => queryClient.setQueryData(customerAdminKeys.notes(customerRef), rows);
  const add = useMutation({ mutationFn: () => addCustomerNote(customerRef, note.trim()), onSuccess: (rows) => { settle(rows); setNote(""); } });
  const remove = useMutation({ mutationFn: (noteId: string) => deleteCustomerNote(customerRef, noteId), onSuccess: settle });
  return (
    <Card title={t("ملاحظات داخلية", "Internal notes")}>
      <div className="ma-stack">
        {notes.data?.length ? (
          notes.data.map((item) => (
            <div key={item.note_id} className="border-b border-line py-3">
              <div className="ma-cell-flex" style={{ justifyContent: "space-between" }}>
                <span><strong>{item.author || "—"}</strong> <span className="ma-cell-sub">{formatDateTime(item.created_at)}</span></span>
                {canWrite ? <Button sm kind="ghost" icon="trash" label={t("حذف", "Delete")} disabled={remove.isPending} onClick={() => remove.mutate(item.note_id)} /> : null}
              </div>
              <p className="whitespace-pre-wrap" style={{ margin: "4px 0 0" }}>{item.body}</p>
            </div>
          ))
        ) : (
          <Empty text={t("لا توجد ملاحظات.", "No notes yet.")} />
        )}
      </div>
      {canWrite ? <form className="mt-4 grid gap-3" onSubmit={(event) => { event.preventDefault(); if (note.trim()) add.mutate(); }}>
        <label className="ma-field">
          <span className="ma-label">{t("ملاحظة جديدة", "New note")}</span>
          <textarea className="ma-input" rows={3} value={note} maxLength={3000} onChange={(event) => setNote(event.target.value)} />
        </label>
        <Button type="submit" kind="primary" label={t("إضافة ملاحظة", "Add note")} disabled={add.isPending || !note.trim()} />
      </form> : null}
      <ErrorAlert error={notes.error ?? add.error ?? remove.error} />
    </Card>
  );
}

const ACTIONS: Record<string, [string, string]> = {
  "customer.updated": ["تعديل البيانات", "Profile edited"],
  "customer.status_changed": ["تغيير الحالة", "Status changed"],
  "customer.access_granted": ["منح وصول", "Access granted"],
  "customer.access_revoked": ["سحب وصول", "Access revoked"],
  "customer.avatar_updated": ["تحديث الصورة", "Photo updated"],
};

export function CustomerHistoryCard({ customerRef }: { customerRef: string }) {
  const t = useT();
  const history = useQuery({ queryKey: customerAdminKeys.history(customerRef), queryFn: () => listCustomerHistory(customerRef) });
  const summary = (value: Record<string, unknown> | null | undefined) =>
    value ? Object.entries(value).filter(([, v]) => v !== null && typeof v !== "object").map(([k, v]) => `${k}: ${String(v)}`).join(" · ") : "";
  return (
    <Card title={t("سجل الإجراءات", "Admin history")}>
      <ErrorAlert error={history.error} />
      {history.data?.length ? (
        <ul className="grid gap-2" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {history.data.map((entry, index) => (
            <li key={`${entry.created_at}-${index}`} className="border-b border-line py-2">
              <strong>{ACTIONS[entry.action] ? t(...ACTIONS[entry.action]) : entry.action}</strong>{" "}
              <span className="ma-cell-sub">{entry.actor || "—"} · {formatDateTime(entry.created_at)}</span>
              {summary(entry.after) ? <p className="ma-cell-sub" style={{ margin: "2px 0 0" }}>{summary(entry.after)}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty text={t("لا توجد إجراءات بعد.", "No admin actions yet.")} />
      )}
    </Card>
  );
}

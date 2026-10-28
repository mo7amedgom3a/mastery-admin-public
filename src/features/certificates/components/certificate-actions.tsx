import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  certificateKeys,
  downloadCertificatePdf,
  openPdfBlob,
  reissueCertificate,
  renameCertificateRecipient,
  revokeCertificate,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { useCan } from "@/lib/permissions";
import { toast } from "@/components/ui/toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { Badge, Button, ErrorAlert, Field, IconButton } from "@/components/ui/kit";

const STATUS: Record<string, { ar: string; en: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  issued: { ar: "صادرة", en: "Issued", tone: "success" },
  pending_name: { ar: "بانتظار الاسم", en: "Waiting for name", tone: "warning" },
  revoked: { ar: "ملغاة", en: "Revoked", tone: "danger" },
};

export function CertificateStatusBadge({ status }: { status: string }) {
  const def = STATUS[status] ?? { ar: status, en: status, tone: "neutral" as const };
  return <Badge def={{ label: { ar: def.ar, en: def.en }, tone: def.tone }} />;
}

/** Row menu for an issued certificate: PDF, public page, fix the name, re-render, revoke. */
export function CertificateActions({
  certificateId,
  status,
  publicCode,
  verifyUrl,
  recipientName,
}: {
  certificateId: string;
  status: string;
  publicCode?: string | null;
  verifyUrl?: string | null;
  recipientName?: string | null;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const canIssue = useCan("certificates.issue");
  const [renameOpen, setRenameOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [name, setName] = useState(recipientName ?? "");
  const [reason, setReason] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: certificateKeys.all });

  const pdf = useMutation({
    mutationFn: () => downloadCertificatePdf(certificateId),
    onSuccess: (blob) => openPdfBlob(blob, `mastery-certificate-${publicCode ?? certificateId}.pdf`),
    onError: (error) => toast.error(t("تعذّر تحميل الشهادة", "Couldn't load the certificate"), String(error)),
  });
  const reissue = useMutation({
    mutationFn: () => reissueCertificate(certificateId),
    onSuccess: () => {
      toast.success(t("أُعيد إصدار الشهادة بالإعدادات الحالية", "Certificate re-rendered with the current settings"));
      refresh();
    },
    onError: (error) => toast.error(t("تعذّرت إعادة الإصدار", "Couldn't reissue"), String(error)),
  });
  const rename = useMutation({
    mutationFn: () => renameCertificateRecipient(certificateId, name.trim()),
    onSuccess: () => {
      toast.success(t("تم تحديث الاسم وإعادة إصدار الشهادة", "Name updated and certificate re-rendered"));
      setRenameOpen(false);
      refresh();
    },
  });
  const revoke = useMutation({
    mutationFn: () => revokeCertificate(certificateId, reason),
    onSuccess: () => {
      toast.success(t("تم إلغاء الشهادة", "Certificate revoked"));
      setRevokeOpen(false);
      refresh();
    },
  });

  const issued = status === "issued";
  const live = status !== "revoked";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton icon="more" label={t("إجراءات الشهادة", "Certificate actions")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={!issued || pdf.isPending} onClick={() => pdf.mutate()}>
            {t("عرض PDF", "View PDF")}
          </DropdownMenuItem>
          {verifyUrl ? (
            <DropdownMenuItem onClick={() => window.open(verifyUrl, "_blank", "noopener")}>
              {t("صفحة التحقق العامة", "Public verification page")}
            </DropdownMenuItem>
          ) : null}
          {canIssue && live ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setRenameOpen(true)}>{t("تصحيح الاسم", "Correct the name")}</DropdownMenuItem>
              <DropdownMenuItem disabled={!issued || reissue.isPending} onClick={() => reissue.mutate()}>
                {t("إعادة الإصدار بالإعدادات الحالية", "Reissue with current settings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setRevokeOpen(true)}>{t("إلغاء الشهادة", "Revoke")}</DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={t("تصحيح الاسم على الشهادة", "Correct the printed name")}
        description={t("يُطبع الاسم بالأحرف الإنجليزية، ويبقى رقم الشهادة كما هو.", "Names are printed in English letters; the certificate code is kept.")}
        footer={
          <>
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setRenameOpen(false)} />
            <Button
              kind="primary"
              label={rename.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ وإعادة الإصدار", "Save & re-render")}
              disabled={rename.isPending || name.trim().length < 2}
              onClick={() => rename.mutate()}
            />
          </>
        }
      >
        <Field id={`rename-${certificateId}`} dir="ltr" label={t("الاسم", "Name")} value={name} maxLength={120} onChange={setName} />
        <ErrorAlert error={rename.error} />
      </Modal>

      <ConfirmModal
        open={revokeOpen}
        onOpenChange={setRevokeOpen}
        tone="danger"
        title={t("إلغاء الشهادة", "Revoke certificate")}
        message={
          <>
            {t(
              "ستظهر الشهادة كملغاة في صفحة التحقق، وتختفي من حساب العميل. يمكن إصدار شهادة جديدة لاحقًا.",
              "Verification will show it as revoked and it leaves the customer's account. A new one can be issued later.",
            )}
            <div style={{ marginTop: 12 }}>
              <Field id={`revoke-${certificateId}`} label={t("السبب (اختياري)", "Reason (optional)")} value={reason} onChange={setReason} />
            </div>
            <ErrorAlert error={revoke.error} />
          </>
        }
        confirmLabel={t("إلغاء الشهادة", "Revoke")}
        loading={revoke.isPending}
        onConfirm={() => revoke.mutate()}
      />
    </>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import {
  duplicateSubscriptionPlan,
  setSubscriptionPlanStatus,
  subscriptionKeys,
  type SubscriptionPlan,
  type SubscriptionPlanStatus,
} from "@/lib/api";
import { can } from "@/lib/permissions";
import { useT } from "@/lib/i18n";
import { Button, ErrorAlert, Field } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

import { copySlug } from "../lib";

/** Publish / unpublish (draft) and duplicate actions for one plan; hidden without catalog write. */
export function PlanActions({ plan, showEdit = false }: { plan: SubscriptionPlan; showEdit?: boolean }) {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState<SubscriptionPlanStatus | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [slug, setSlug] = useState(copySlug(plan.slug));
  const writable = can("subscriptionsWrite.write");

  const status = useMutation({
    mutationFn: (next: SubscriptionPlanStatus) => setSubscriptionPlanStatus(plan.plan_id, next),
    onSuccess: (updated) => {
      setConfirm(null);
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(
        updated.status === "published"
          ? t("تم نشر الباقة", "Plan published")
          : updated.status === "archived"
            ? t("تمت أرشفة الباقة", "Plan archived")
            : t("أصبحت الباقة مسودة", "Plan moved to draft"),
      );
    },
    onError: (error) => {
      setConfirm(null);
      toast.error(t("تعذّر تغيير الحالة", "Couldn't change the status"), error instanceof Error ? error.message : undefined);
    },
  });

  const duplicate = useMutation({
    mutationFn: () => duplicateSubscriptionPlan(plan.plan_id, slug.trim()),
    onSuccess: (created) => {
      setCopyOpen(false);
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
      toast.success(t("تم إنشاء نسخة كمسودة", "Draft copy created"));
      navigate(`/subscriptions/plans/${created.plan_id}`);
    },
  });

  const published = plan.status === "published";
  const confirmText: Record<SubscriptionPlanStatus, [string, string]> = {
    published: [
      "ستظهر الباقة للعملاء ويمكنهم الاشتراك فيها فورًا.",
      "Customers will see this plan and can subscribe right away.",
    ],
    draft: [
      "ستختفي الباقة من صفحة الأسعار ولن يتمكن أحد من الاشتراك. المشتركون الحاليون يحتفظون باشتراكاتهم.",
      "The plan disappears from the pricing page and nobody can subscribe. Existing subscribers keep their subscriptions.",
    ],
    archived: [
      "تُخفى الباقة نهائيًا من صفحة الأسعار. المشتركون الحاليون يحتفظون باشتراكاتهم.",
      "The plan is retired from the pricing page. Existing subscribers keep their subscriptions.",
    ],
  };

  return (
    <>
      {showEdit ? <Button sm kind="soft" icon="edit" label={t("إدارة", "Manage")} href={`/subscriptions/plans/${plan.plan_id}`} /> : null}
      {writable ? (
        <>
          {published ? (
            <Button sm kind="soft" icon="eye" label={t("إلغاء النشر", "Unpublish")} onClick={() => setConfirm("draft")} />
          ) : (
            <Button sm kind="primary" icon="send" label={t("نشر", "Publish")} onClick={() => setConfirm("published")} />
          )}
          <Button sm kind="soft" icon="copy" label={t("نسخ", "Duplicate")} onClick={() => { setSlug(copySlug(plan.slug)); setCopyOpen(true); }} />
          {plan.status !== "archived" && !showEdit ? (
            <Button sm kind="ghost" icon="folder" label={t("أرشفة", "Archive")} onClick={() => setConfirm("archived")} />
          ) : null}
        </>
      ) : null}

      <ConfirmModal
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        tone={confirm === "published" ? "primary" : "warning"}
        title={
          confirm === "published"
            ? t("نشر الباقة؟", "Publish this plan?")
            : confirm === "archived"
              ? t("أرشفة الباقة؟", "Archive this plan?")
              : t("إعادة الباقة إلى مسودة؟", "Move this plan to draft?")
        }
        message={confirm ? t(confirmText[confirm][0], confirmText[confirm][1]) : ""}
        confirmLabel={confirm === "published" ? t("نشر", "Publish") : t("تأكيد", "Confirm")}
        loading={status.isPending}
        onConfirm={() => confirm && status.mutate(confirm)}
      />

      <Modal
        open={copyOpen}
        onOpenChange={setCopyOpen}
        size="sm"
        title={t("نسخ الباقة", "Duplicate plan")}
        description={t(
          "تُنسخ البيانات وعناصر البطاقة والموارد والمزايا والخصم إلى مسودة جديدة.",
          "Content, card items, resources, benefits and discount are copied into a new draft.",
        )}
        footer={
          <>
            <Button kind="primary" label={duplicate.isPending ? t("جارٍ النسخ…", "Copying…") : t("إنشاء النسخة", "Create copy")}
              disabled={!slug.trim() || duplicate.isPending} onClick={() => duplicate.mutate()} />
            <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => setCopyOpen(false)} />
          </>
        }
      >
        <Field id="copy-slug" label={t("رابط النسخة (slug)", "Copy slug")} value={slug} onChange={setSlug} dir="ltr" required />
        <ErrorAlert error={duplicate.error} />
      </Modal>
    </>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  cancelSubscriber,
  customerAdminKeys,
  entitlementAdminKeys,
  extendSubscriber,
  resumeSubscriber,
  revokeSubscriber,
  subscriptionKeys,
  type SubscriberDetail,
} from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Button, Dl, ErrorAlert, Field, FormActions } from "@/components/ui/kit";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

/* Admin lifecycle actions for one customer subscription: cancel (period end / now), resume, extend, revoke. */

export type SubscriberAction = "cancel_period_end" | "cancel_now" | "resume" | "revoke";

const DAY_MS = 86_400_000;
const PRESETS = [7, 14, 30] as const;

function useRefreshSubscription() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: subscriptionKeys.all });
    // Access rows on the customer page follow the subscription.
    void queryClient.invalidateQueries({ queryKey: entitlementAdminKeys.all });
    void queryClient.invalidateQueries({ queryKey: customerAdminKeys.all });
  };
}

export function SubscriberActionModal({
  subscription,
  action,
  onClose,
}: {
  subscription: SubscriberDetail;
  action: SubscriberAction;
  onClose: () => void;
}) {
  const t = useT();
  const refresh = useRefreshSubscription();
  const [reason, setReason] = useState("");
  // One key per dialog: a double submit or a retry repeats the same Stripe call.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const ends = formatDate(subscription.current_period_end);
  const reasonRequired = action === "revoke";
  const copy = {
    cancel_period_end: {
      title: t("إلغاء بنهاية الفترة؟", "Cancel at the end of the period?"),
      body: t(
        `يبقى الوصول حتى ${ends} ثم يتوقف التجديد. يمكن للعميل أو للإدارة التراجع قبل هذا التاريخ.`,
        `Access continues until ${ends}, then renewal stops. The customer or an admin can undo it before then.`,
      ),
      confirm: t("إلغاء بنهاية الفترة", "Cancel at period end"),
      done: t("سيتوقف التجديد بنهاية الفترة", "Renewal will stop at period end"),
      kind: "primary" as const,
    },
    cancel_now: {
      title: t("إلغاء الاشتراك فورًا؟", "Cancel the subscription now?"),
      body: t(
        "يفقد المشترك الوصول لكل موارد الباقة الآن ويتوقف التجديد في Stripe. لا يمكن التراجع.",
        "The subscriber loses access to every plan resource now and Stripe stops billing. This can't be undone.",
      ),
      confirm: t("إلغاء فوري", "Cancel now"),
      done: t("تم إلغاء الاشتراك", "Subscription canceled"),
      kind: "danger" as const,
    },
    resume: {
      title: t("استئناف الاشتراك؟", "Resume this subscription?"),
      body: t(
        `يُلغى الإلغاء المجدول ويتجدد الاشتراك تلقائياً في ${ends} بالسعر نفسه.`,
        `The scheduled cancellation is undone and the subscription renews on ${ends} at the same price.`,
      ),
      confirm: t("استئناف", "Resume"),
      done: t("تم استئناف الاشتراك", "Subscription resumed"),
      kind: "primary" as const,
    },
    revoke: {
      title: t("سحب الاشتراك والوصول؟", "Revoke the subscription and its access?"),
      body: t(
        "ينتهي الاشتراك فوراً ويُسحب الوصول لكل موارد الباقة، ولا يُسترد المبلغ تلقائياً. يُسجَّل السبب في سجل التدقيق.",
        "The subscription ends now and every plan resource is revoked; nothing is refunded automatically. The reason goes to the audit log.",
      ),
      confirm: t("سحب نهائي", "Revoke"),
      done: t("تم سحب الاشتراك", "Subscription revoked"),
      kind: "danger" as const,
    },
  }[action];

  const mutation = useMutation({
    mutationFn: () => {
      const id = subscription.subscription_id;
      const note = reason.trim() || null;
      if (action === "resume") return resumeSubscriber(id, { reason: note }, idempotencyKey);
      if (action === "revoke") return revokeSubscriber(id, { reason: reason.trim() }, idempotencyKey);
      return cancelSubscriber(id, { immediate: action === "cancel_now", reason: note }, idempotencyKey);
    },
    onSuccess: () => {
      refresh();
      toast.success(copy.done);
      onClose();
    },
  });

  return (
    <Modal open onOpenChange={(value) => !value && onClose()} title={copy.title} description={subscription.plan_title ?? undefined}
      footer={
        <FormActions>
          <Button kind={copy.kind} disabled={(reasonRequired && reason.trim().length < 3) || mutation.isPending}
            label={copy.confirm} onClick={() => mutation.mutate()} />
          <Button kind="ghost" label={t("رجوع", "Back")} onClick={onClose} />
        </FormActions>
      }>
      <div className="grid gap-3">
        <p className="ma-help" style={{ margin: 0 }}>{copy.body}</p>
        <Field id={`subscription-${action}-reason`} type="textarea" rows={2} required={reasonRequired}
          label={reasonRequired ? t("السبب", "Reason") : t("السبب (اختياري)", "Reason (optional)")}
          value={reason} onChange={setReason} hint={t("يُحفظ في سجل التدقيق.", "Saved in the audit log.")} />
        <ErrorAlert error={mutation.error} />
      </div>
    </Modal>
  );
}

export function SubscriberExtendModal({ subscription, onClose }: { subscription: SubscriberDetail; onClose: () => void }) {
  const t = useT();
  const refresh = useRefreshSubscription();
  const [choice, setChoice] = useState<string>("7");
  const [custom, setCustom] = useState("");
  const [reason, setReason] = useState("");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const days = choice === "custom" ? Number.parseInt(custom, 10) : Number.parseInt(choice, 10);
  const valid = reason.trim().length >= 3 && Number.isFinite(days) && days >= 1 && days <= 365;
  const preview = Number.isFinite(days)
    ? new Date(new Date(subscription.current_period_end).getTime() + days * DAY_MS).toISOString()
    : null;

  const extend = useMutation({
    mutationFn: () => extendSubscriber(subscription.subscription_id, { days, reason: reason.trim() }, `${idempotencyKey}-${days}`),
    onSuccess: () => {
      refresh();
      toast.success(t("تم تمديد الاشتراك", "Subscription extended"));
      onClose();
    },
  });

  return (
    <Modal open onOpenChange={(value) => !value && onClose()} title={t("تمديد الاشتراك", "Extend subscription")}
      description={subscription.plan_title ?? undefined}
      footer={
        <FormActions>
          <Button kind="primary" icon="check" disabled={!valid || extend.isPending}
            label={extend.isPending ? t("جارٍ التمديد…", "Extending…") : t("تمديد", "Extend")} onClick={() => extend.mutate()} />
          <Button kind="ghost" label={t("رجوع", "Back")} onClick={onClose} />
        </FormActions>
      }>
      <div className="grid gap-3">
        <div className="ma-cell-flex" role="radiogroup" style={{ gap: "8px", flexWrap: "wrap" }}>
          {[...PRESETS.map(String), "custom"].map((value) => (
            <label key={value} className="ma-cell-flex" style={{ gap: "6px" }}>
              <input type="radio" name="subscription-extend-days" checked={choice === value} onChange={() => setChoice(value)} />
              {value === "custom" ? t("مدة أخرى", "Other") : t(`${value} يوماً`, `${value} days`)}
            </label>
          ))}
        </div>
        {choice === "custom" ? (
          <Field id="subscription-extend-custom" type="number" label={t("عدد الأيام", "Days")} value={custom} onChange={setCustom}
            hint={t("من 1 إلى 365.", "1 to 365.")} />
        ) : null}
        <Dl
          rows={[
            [t("نهاية الفترة الحالية", "Current period end"), formatDate(subscription.current_period_end)],
            [t("النهاية الجديدة", "New period end"), formatDate(preview)],
          ]}
        />
        <p className="ma-help" style={{ margin: 0 }}>
          {subscription.stripe_subscription_id
            ? t("تُمدَّد موارد الباقة معها، ويؤجَّل الخصم التالي في Stripe إلى النهاية الجديدة دون رسوم إضافية.",
                "The plan's access moves with it, and Stripe's next charge is pushed to the new end at no extra cost.")
            : t("تُمدَّد موارد الباقة معها.", "The plan's access moves with it.")}
        </p>
        <Field id="subscription-extend-reason" type="textarea" rows={2} required label={t("السبب", "Reason")} value={reason} onChange={setReason}
          hint={t("يُحفظ في سجل التدقيق، مثل «تعويض عن انقطاع الخدمة».", "Saved in the audit log, e.g. “compensation for an outage”.")} />
        <ErrorAlert error={extend.error} />
      </div>
    </Modal>
  );
}

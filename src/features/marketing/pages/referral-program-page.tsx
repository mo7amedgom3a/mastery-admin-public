import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  affiliatesKeys,
  affiliatesQueries,
  grantReferralReward,
  listReferralRewards,
  saveReferralProgram,
  type ReferralProgram,
  type ReferralReward,
} from "@/lib/api";
import { formatDateTime, formatMinor } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, ErrorAlert, Field, FormActions, Loading, PageHead } from "@/components/ui/kit";
import { type Column } from "@/components/ui/data-table";
import { PagedList } from "@/components/ui/paged-list";
import { PageState } from "@/components/ui/primitives";

import { rewardStatusBadge } from "../lib/affiliates";

function SettingsForm({ program }: { program: ReferralProgram }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    is_active: program.is_active,
    reward: String(program.referrer_reward_minor / 100),
    validity: String(program.reward_validity_days),
    friend: String(program.friend_discount_percent),
    friendDays: String(program.friend_coupon_validity_days),
    minOrder: String(program.min_order_minor / 100),
    holding: String(program.holding_days),
    cap: program.max_rewards_per_referrer != null ? String(program.max_rewards_per_referrer) : "",
  });
  const set = (key: keyof typeof form) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const save = useMutation({
    mutationFn: () =>
      saveReferralProgram({
        is_active: form.is_active,
        referrer_reward_minor: Math.round(Number(form.reward || 0) * 100),
        reward_validity_days: Number(form.validity || 1),
        friend_discount_percent: form.friend || "0",
        friend_coupon_validity_days: Number(form.friendDays || 1),
        min_order_minor: Math.round(Number(form.minOrder || 0) * 100),
        holding_days: Number(form.holding || 0),
        max_rewards_per_referrer: form.cap ? Number(form.cap) : null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: affiliatesKeys.referralProgram() }),
  });
  const readOnly = !can("affiliatesWrite.manage");
  return (
    <form className="ma-form" onSubmit={(e) => { e.preventDefault(); if (!readOnly) save.mutate(); }}>
      <label className="ma-check" htmlFor="ref-active">
        <input id="ref-active" type="checkbox" checked={form.is_active} disabled={readOnly} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
        <span>{t("البرنامج مفعّل للطلاب", "Program open to students")}</span>
      </label>
      <div className="ma-form-grid ma-form-grid--2">
        <Field id="ref-reward" type="number" label={t("مكافأة المُحيل (USD)", "Referrer reward (USD)")} hint={t("قسيمة رصيد لكل صديق اشترى.", "A voucher per friend who bought.")} min={0} step="0.01" dir="ltr" disabled={readOnly} value={form.reward} onChange={set("reward")} />
        <Field id="ref-validity" type="number" label={t("صلاحية القسيمة (أيام)", "Voucher validity (days)")} min={1} dir="ltr" disabled={readOnly} value={form.validity} onChange={set("validity")} />
        <Field id="ref-friend" type="number" label={t("خصم الصديق (%)", "Friend discount (%)")} hint={t("كوبون شخصي لأول شراء.", "Personal first-purchase coupon.")} min={0} max={100} dir="ltr" disabled={readOnly} value={form.friend} onChange={set("friend")} />
        <Field id="ref-friend-days" type="number" label={t("صلاحية كوبون الصديق (أيام)", "Friend coupon validity (days)")} min={1} dir="ltr" disabled={readOnly} value={form.friendDays} onChange={set("friendDays")} />
        <Field id="ref-min" type="number" label={t("أدنى قيمة لطلب الصديق (USD)", "Friend's minimum order (USD)")} min={0} step="0.01" dir="ltr" disabled={readOnly} value={form.minOrder} onChange={set("minOrder")} />
        <Field id="ref-holding" type="number" label={t("فترة الانتظار (أيام)", "Holding period (days)")} hint={t("تُمنح المكافأة بعدها إن لم يُسترد الطلب.", "Granted after this if the order isn't refunded.")} min={0} dir="ltr" disabled={readOnly} value={form.holding} onChange={set("holding")} />
        <Field id="ref-cap" type="number" label={t("حد المكافآت لكل طالب", "Max rewards per student")} hint={t("فارغ = بلا حد.", "Empty = unlimited.")} min={1} dir="ltr" disabled={readOnly} value={form.cap} onChange={set("cap")} />
      </div>
      <ErrorAlert error={save.error} title={t("تعذّر الحفظ", "Couldn't save")} />
      {save.isSuccess ? <p className="ma-help">{t("تم الحفظ.", "Saved.")}</p> : null}
      {readOnly ? null : (
        <FormActions>
          <Button type="submit" kind="primary" icon="check" disabled={save.isPending} label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ الإعدادات", "Save settings")} />
        </FormActions>
      )}
    </form>
  );
}

function Rewards() {
  const t = useT();
  const queryClient = useQueryClient();
  const grant = useMutation({ mutationFn: grantReferralReward, onSuccess: () => queryClient.invalidateQueries({ queryKey: affiliatesKeys.all }) });
  const columns: Column<ReferralReward>[] = [
    { key: "referrer", header: t("المُحيل", "Referrer"), exportValue: (r) => r.referrer_email ?? "", cell: (r) => <AppLink className="ma-link" to={`/customers/${r.referrer_customer_id}`}><bdi>{r.referrer_email}</bdi></AppLink> },
    { key: "friend", header: t("الصديق", "Friend"), exportValue: (r) => r.referred_email ?? "", cell: (r) => <AppLink className="ma-link" to={`/customers/${r.referred_customer_id}`}><bdi>{r.referred_name || r.referred_email}</bdi></AppLink> },
    { key: "order", header: t("الطلب", "Order"), exportValue: (r) => r.order_id, cell: (r) => <AppLink className="ma-link ma-num" to={`/sales/orders/${r.order_id}`}>{r.order_id.slice(0, 8)}</AppLink> },
    { key: "amount", header: t("المكافأة", "Reward"), align: "end", exportKind: "number", exportValue: (r) => r.amount_minor / 100, cell: (r) => <span className="ma-num">{formatMinor(r.amount_minor)}</span> },
    { key: "status", header: t("الحالة", "Status"), exportValue: (r) => r.status, cell: (r) => <Badge def={rewardStatusBadge(r.status)} /> },
    { key: "eligible", header: t("تُمنح في", "Eligible at"), exportKind: "datetime", exportValue: (r) => r.eligible_at, cell: (r) => formatDateTime(r.eligible_at) },
    {
      key: "actions", header: "", exportable: false, align: "end",
      cell: (r) => (r.status === "pending" && can("affiliatesWrite.manage") ? <Button sm label={t("امنح الآن", "Grant now")} disabled={grant.isPending} onClick={() => grant.mutate(r.reward_id)} /> : r.voucher_id ? <AppLink className="ma-link" to={`/sales/vouchers/${r.voucher_id}`}>{t("القسيمة", "Voucher")}</AppLink> : null),
    },
  ];
  return (
    <>
      <ErrorAlert error={grant.error} title={t("تعذّر منح المكافأة", "Couldn't grant the reward")} />
      <PagedList
        queryKeyBase={affiliatesKeys.rewards()}
        fetchPage={({ offset, limit, filters }) => listReferralRewards({ status: (filters.status || undefined) as never, offset, limit })}
        columns={columns}
        filters={[{ key: "status", label: t("كل الحالات", "All states"), options: [
          { value: "pending", label: t("فترة انتظار", "Holding") },
          { value: "granted", label: t("مُنحت", "Granted") },
          { value: "revoked", label: t("أُلغيت", "Revoked") },
        ] }]}
        empty={t("لا مكافآت بعد.", "No rewards yet.")}
        exportConfig={{ filename: "referral-rewards", title: t("مكافآت الإحالة", "Referral rewards"), fetchSize: 200 }}
      />
    </>
  );
}

export default function ReferralProgramPage() {
  const t = useT();
  const program = useQuery(affiliatesQueries.referralProgram());
  return (
    <>
      <PageHead
        title={t("برنامج ادعُ صديقًا", "Invite-a-friend program")}
        sub={t("الطالب يشارك رابطه؛ الصديق يحصل على خصم أول شراء، والطالب على قسيمة رصيد بعد فترة الانتظار.", "Students share their link; the friend gets a first-purchase discount, the student a voucher after the holding period.")}
      />
      <Card title={t("الإعدادات", "Settings")}>
        <PageState error={program.error}>{program.data ? <SettingsForm program={program.data} /> : <Loading />}</PageState>
      </Card>
      <h2 className="ma-section-title">{t("المكافآت", "Rewards")}</h2>
      <Rewards />
    </>
  );
}

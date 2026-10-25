import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { affiliatesKeys, affiliatesQueries, assignCustomer, listPartners, unassignCustomer } from "@/lib/api";
import { formatDate, formatDateTime, formatMinor, formatNumber } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Dl, ErrorAlert, Field, Loading } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";

import { rewardStatusBadge, syncStatusBadge } from "@/features/marketing/lib/affiliates";

const SOURCE: Record<string, { ar: string; en: string }> = {
  link: { ar: "رابط إحالة", en: "Referral link" },
  coupon: { ar: "كوبون المسوّق", en: "Affiliate coupon" },
  admin: { ar: "تعيين يدوي", en: "Assigned by admin" },
  tolt_lead: { ar: "Tolt", en: "Tolt" },
};

/** Affiliate / referral picture of one customer: who brought them and whom they brought. */
export function CustomerReferralsCard({ customerId }: { customerId: string }) {
  const t = useT();
  const lang = useLang();
  const queryClient = useQueryClient();
  const data = useQuery(affiliatesQueries.customerReferrals(customerId));
  const [code, setCode] = useState("");
  const canWrite = can("affiliatesWrite.manage");
  const refresh = () => queryClient.invalidateQueries({ queryKey: affiliatesKeys.all });

  const assign = useMutation({
    mutationFn: async () => {
      const page = await listPartners({ query: code.trim(), limit: 5 });
      const partner = page.items.find((p) => p.referral_code === code.trim().toLowerCase()) ?? page.items[0];
      if (!partner) throw new Error(t("لا يوجد مسوّق بهذا الكود.", "No affiliate with this code."));
      await assignCustomer({ customer_id: customerId, partner_id: partner.partner_id, replace: false });
    },
    onSuccess: () => { setCode(""); refresh(); },
  });
  const unassign = useMutation({ mutationFn: () => unassignCustomer(customerId), onSuccess: refresh });

  const d = data.data;
  const a = d?.attribution;
  const p = d?.partner;

  return (
    <Card title={t("الإحالة والتسويق بالعمولة", "Referrals & affiliates")}>
      <PageState error={data.error}>
        {data.isLoading || !d ? <Loading /> : (
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div>
              <h3 className="ma-section-title" style={{ marginBlockStart: 0 }}>{t("من أحاله", "Referred by")}</h3>
              {a ? (
                <>
                  <Dl
                    rows={[
                      [t("الشريك", "Partner"), <AppLink key="p" className="ma-link" to={`/marketing/affiliates/${a.partner_id}`}>{a.partner_name || a.partner_code}</AppLink>],
                      [t("الطريقة", "How"), (SOURCE[a.source] ?? { ar: a.source, en: a.source })[lang]],
                      [t("الكود", "Code"), <bdi key="c" className="ma-num">{a.ref_value ?? a.partner_code}</bdi>],
                      [t("التاريخ", "Date"), formatDateTime(a.attributed_at)],
                      [t("طلبات مدفوعة عبره", "Paid orders via partner"), `${formatNumber(a.paid_orders)} · ${formatMinor(a.revenue_minor)}`],
                      ["Tolt", <Badge key="s" def={syncStatusBadge(a.sync_status)} />],
                    ]}
                  />
                  {canWrite && a.paid_orders === 0 ? (
                    <Button sm kind="ghost" icon="x" label={t("إزالة النسبة", "Remove attribution")} disabled={unassign.isPending} onClick={() => unassign.mutate()} />
                  ) : null}
                </>
              ) : (
                <>
                  <p className="ma-help">{t("لم يأتِ عبر مسوّق أو صديق.", "Not referred by an affiliate or a friend.")}</p>
                  {canWrite ? (
                    <form
                      style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", flexWrap: "wrap" }}
                      onSubmit={(e) => { e.preventDefault(); if (code.trim()) assign.mutate(); }}
                    >
                      <Field id="assign-code" label={t("نسبه إلى مسوّق (كود الإحالة)", "Assign to affiliate (referral code)")} dir="ltr" value={code} onChange={setCode} />
                      <Button type="submit" sm kind="primary" label={t("نسب", "Assign")} disabled={!code.trim() || assign.isPending} />
                    </form>
                  ) : null}
                </>
              )}
              <ErrorAlert error={assign.error ?? unassign.error} title={t("تعذّر تحديث النسبة", "Couldn't update the attribution")} />
            </div>

            <div>
              <h3 className="ma-section-title">{t("إحالاته", "Their referrals")}</h3>
              {p ? (
                <>
                  <Dl
                    rows={[
                      [t("النوع", "Type"), p.kind === "student" ? t("طالب في برنامج ادعُ صديقًا", "Student referrer") : t("مسوّق", "Marketer")],
                      [t("الرابط", "Link"), <AppLink key="l" className="ma-link ma-num" to={`/marketing/affiliates/${p.partner_id}`}><bdi>{p.referral_link}</bdi></AppLink>],
                      [t("سجّلوا / اشتروا", "Signed up / bought"), `${formatNumber(d.invited)} / ${formatNumber(d.qualified)}`],
                      [t("مكافآت", "Rewards"), t(`${d.granted_rewards} مُنحت · ${d.pending_rewards} قيد الانتظار · ${formatMinor(d.earned_minor)}`, `${d.granted_rewards} granted · ${d.pending_rewards} pending · ${formatMinor(d.earned_minor)}`)],
                    ]}
                  />
                  {d.rewards.length ? (
                    <ul className="ma-list" style={{ margin: 0, paddingInlineStart: "1.2em" }}>
                      {d.rewards.map((r) => (
                        <li key={r.reward_id}>
                          <bdi>{r.referred_email}</bdi> — {formatMinor(r.amount_minor)} <Badge def={rewardStatusBadge(r.status)} />{" "}
                          {r.voucher_id ? <AppLink className="ma-link" to={`/sales/vouchers/${r.voucher_id}`}>{t("القسيمة", "Voucher")}</AppLink> : t(`حتى ${formatDate(r.eligible_at)}`, `until ${formatDate(r.eligible_at)}`)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p className="ma-help">{t("لم ينضم لبرنامج ادعُ صديقًا.", "Hasn't joined the invite-a-friend program.")}</p>
              )}
            </div>
          </div>
        )}
      </PageState>
    </Card>
  );
}

import { useQuery } from "@tanstack/react-query";

import { referralsQueries } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Card, Empty, Loading, PageHead } from "@/components/ui/kit";
import { PageState } from "@/components/ui/primitives";
import { RichHtml } from "@/components/ui/rich-html";

/** The affiliate program policy, as ordered rich-text sections (`/admin/referrals/policies`). */
export default function PoliciesPage() {
  const t = useT();
  const policies = useQuery(referralsQueries.policies());

  const rows = (policies.data?.items ?? [])
    .filter((row) => row.title || row.body)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.legacy_policy_id - b.legacy_policy_id);

  return (
    <>
      <PageHead title={t("سياسة برنامج العمولة", "Affiliate program policy")} sub={t("بنود سياسة برنامج التسويق بالعمولة.", "The terms of the affiliate marketing program.")} />
      <PageState error={policies.error}>
        {policies.isLoading ? (
          <Loading />
        ) : rows.length ? (
          <Card>
            <div className="ma-stack">
              {rows.map((row) => (
                <section key={row.legacy_policy_id}>
                  {row.title ? <h3 className="ma-subhead">{row.title}</h3> : null}
                  <RichHtml html={row.body ?? null} />
                </section>
              ))}
            </div>
          </Card>
        ) : (
          <Empty icon="shield" text={t("لا سياسة منشورة.", "No policy published.")} />
        )}
      </PageState>
    </>
  );
}

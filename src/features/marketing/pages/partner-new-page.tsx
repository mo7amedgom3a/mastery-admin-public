import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { affiliatesKeys, createPartner } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Card, PageHead } from "@/components/ui/kit";

import { PartnerForm } from "../components/partner-form";

export default function PartnerNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const create = useMutation({
    mutationFn: createPartner,
    onSuccess: (partner) => {
      queryClient.invalidateQueries({ queryKey: affiliatesKeys.all });
      navigate(`/marketing/affiliates/${partner.partner_id}`);
    },
  });
  return (
    <>
      <PageHead
        title={t("إضافة مسوّق", "Add affiliate")}
        sub={t("يُنشأ هنا وفي Tolt مع رابط إحالة خاص به.", "Created here and in Tolt, with their own referral link.")}
        back={{ href: "/marketing/affiliates", label: t("المسوقون", "Affiliates") }}
      />
      <Card title={t("بيانات المسوّق", "Affiliate details")}>
        <PartnerForm pending={create.isPending} error={create.error} submitLabel={t("إضافة", "Add")} cancelHref="/marketing/affiliates" onSubmit={(body) => create.mutate(body)} />
      </Card>
    </>
  );
}

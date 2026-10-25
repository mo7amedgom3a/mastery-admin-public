import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { couponsKeys, createCoupon } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Card, PageHead } from "@/components/ui/kit";

import { CouponForm } from "../components/coupon-form";

export default function CouponNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const create = useMutation({
    mutationFn: createCoupon,
    onSuccess: (coupon) => {
      queryClient.invalidateQueries({ queryKey: couponsKeys.all });
      navigate(`/sales/coupons/${coupon.promotion_id}`);
    },
  });

  return (
    <>
      <PageHead
        title={t("إنشاء كوبون", "Create coupon")}
        sub={t("كود خصم يكتبه العميل عند الدفع.", "A discount code customers enter at checkout.")}
        back={{ href: "/sales/coupons", label: t("الكوبونات", "Coupons") }}
      />
      <Card title={t("بيانات الكوبون", "Coupon details")}>
        <CouponForm
          pending={create.isPending}
          error={create.error}
          submitLabel={t("حفظ الكوبون", "Save coupon")}
          cancelHref="/sales/coupons"
          onSubmit={(body) => create.mutate(body)}
        />
      </Card>
    </>
  );
}

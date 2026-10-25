import { useT } from "@/lib/i18n";
import { PageHead } from "@/components/ui/kit";
import { EntitlementDirectory } from "@/features/entitlements/components/entitlement-lists";

/** Every customer's product access: find access that ends soon, extend, suspend, reinstate or revoke it. */
export default function EntitlementsPage() {
  const t = useT();
  return (
    <>
      <PageHead
        title={t("وصول العملاء", "Customer access")}
        sub={t(
          "وصول كل عميل إلى كل منتج: مدد، أوقف مؤقتاً، استأنف أو اسحب الوصول.",
          "Each customer's access to each product: extend, suspend, reinstate or revoke it.",
        )}
      />
      <EntitlementDirectory />
    </>
  );
}

import { useT } from "@/lib/i18n";
import { PageHead } from "@/components/ui/kit";
import { CustomerDirectory } from "@/features/customers/pages/customers-page";

/** Legacy accounts not imported into B2C yet (imported ones are B2C customers). */
export default function AccountsPage() {
  const t = useT();
  return (
    <>
      <PageHead
        title={t("الاستعلام عن مشترك", "Account lookup")}
        sub={t(
          "الحسابات القديمة التي لم تُنقل إلى B2C؛ ابحث بالبريد أو الاسم أو الهاتف أو الرقم القديم.",
          "Legacy accounts not imported into B2C yet; search by email, name, phone or legacy id.",
        )}
      />
      <CustomerDirectory initialSource="legacy" />
    </>
  );
}

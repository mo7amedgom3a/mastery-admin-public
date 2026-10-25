import { useT } from "@/lib/i18n";
import { Card, Empty, PageHead } from "@/components/ui/kit";

/**
 * Empty state for destinations that have no backend endpoint yet. The shell and navigation stay
 * usable; the page makes no claims and shows no fabricated data.
 */
export default function PlaceholderPage({ titleAr, titleEn }: { titleAr: string; titleEn: string }) {
  const t = useT();
  return (
    <>
      <PageHead title={t(titleAr, titleEn)} />
      <Card>
        <Empty
          icon="clipboard"
          text={t("لا يتوفر هذا القسم بعد في واجهة الخادم.", "This section isn't available from the backend yet.")}
        />
      </Card>
    </>
  );
}

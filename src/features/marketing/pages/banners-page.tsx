import { useT } from "@/lib/i18n";
import { PageHead } from "@/components/ui/kit";
import type { QueryKey, UseQueryOptions } from "@tanstack/react-query";

import { contentQueries } from "@/lib/api";
import { AdminListPanel } from "@/components/ui/admin-list-panel";

const q = (options: unknown) => options as UseQueryOptions<unknown, Error, unknown, QueryKey>;

export default function BannersPage() {
  const t = useT();
  return (
    <>
      <PageHead title={t("البانرات والسلايدر", "Banners & sliders")} sub={t("بانرات وسلايدر الصفحة الرئيسية.", "Home page banners and slider.")} />
      <div className="ma-section-gap">
        <AdminListPanel
          hideHead
          panelTitle={t("البانرات", "Banners")}
          titleAr="البانرات"
          titleEn="Banners"
          subAr=""
          subEn=""
          query={q(contentQueries.banners({ limit: 200 }))}
          columns={["order", "title", "subtitle", "image_url", "link_url", "product_ref"]}
        />
      </div>
      <div className="ma-section-gap">
        <AdminListPanel
          hideHead
          panelTitle={t("السلايدر", "Sliders")}
          titleAr="السلايدر"
          titleEn="Sliders"
          subAr=""
          subEn=""
          query={q(contentQueries.sliders({ limit: 200 }))}
          columns={["order", "name", "title", "description", "image", "link"]}
        />
      </div>
    </>
  );
}

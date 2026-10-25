import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";

export type DetailTab =
  | "overview"
  | "content"
  | "resources"
  | "instructors"
  | "package"
  | "bundle"
  | "consultation"
  | "live_diploma"
  | "orders"
  | "access"
  | "related"
  | "legacy";

export type DetailTabId = DetailTab;

export interface DetailTabDef {
  id: DetailTab;
  labelAr: string;
  labelEn: string;
  count?: number;
}

export interface DetailTabbarProps {
  activeTab: DetailTab;
  /** Tabs to render, in order; the page decides them from the product type. */
  tabs: DetailTabDef[];
  onSelectTab: (tab: DetailTab) => void;
  title?: string;
  productTitle?: string;
  isPublished?: boolean;
  onTogglePublish?: () => void;
}

export function DetailTabbar({
  activeTab,
  tabs,
  onSelectTab,
  title,
  productTitle,
  isPublished,
  onTogglePublish,
}: DetailTabbarProps) {
  const t = useT();
  const [isStuck, setIsStuck] = useState(false);

  const displayTitle = title || productTitle || "";
  const pub = isPublished ?? false;

  useEffect(() => {
    const handleScroll = () => {
      setIsStuck(window.scrollY > 220);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className={`cd-tabbar ${isStuck ? "is-stuck" : ""}`}>
      <div className="cd-tabs" role="tablist" aria-label={displayTitle}>
        {tabs.map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              className="cd-tab"
              aria-selected={isSelected}
              onClick={() => onSelectTab(tab.id)}
            >
              <span>{t(tab.labelAr, tab.labelEn)}</span>
              {tab.count != null && tab.count > 0 && <span className="cd-tab__n">{tab.count}</span>}
            </button>
          );
        })}
      </div>

      <div className="cd-mini">
        <span className="cd-mini__t">{displayTitle}</span>
        <button type="button" className="ma-btn ma-btn--sm ma-btn--soft" onClick={onTogglePublish}>
          {pub ? t("إلغاء النشر", "Unpublish") : t("نشر", "Publish")}
        </button>
      </div>
    </div>
  );
}

export { DetailTabbar as DetailTabBar };

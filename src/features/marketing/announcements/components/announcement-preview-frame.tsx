import { useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";

import { useT } from "@/lib/i18n";
import { StorefrontViewport } from "@/features/learning/studio/preview/storefront-frame";
import { usePreviewChannel, type PreviewDevice } from "@/features/learning/studio/preview/use-preview-channel";

/**
 * Live preview: the storefront's real announcement bar above the real header (`mastery-front /preview/announcement-bar`).
 * The editor posts the bar in the public API shape — saved items with unsaved edits on top — on every change.
 */
export function AnnouncementPreviewFrame({ bar }: { bar: Record<string, unknown> }) {
  const t = useT();
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const message = useMemo(() => ({ type: "render", kind: "announcement-bar", bar }), [bar]);
  const { frameRef, url, ready, blocked, reload, notifyLoaded } = usePreviewChannel("/preview/announcement-bar", message);

  return (
    <div className="ma-ann-preview">
      <div className="ma-ann-preview__bar">
        <span className="ma-label">{t("معاينة حية من المتجر", "Live storefront preview")}</span>
        <div className="ma-seg" role="group" aria-label={t("جهاز المعاينة", "Preview device")}>
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title={t("سطح المكتب", "Desktop")}>
            <Monitor size={16} aria-hidden />
          </button>
          <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title={t("الجوال", "Mobile")}>
            <Smartphone size={16} aria-hidden />
          </button>
        </div>
      </div>
      <StorefrontViewport
        frameRef={frameRef}
        url={url}
        ready={ready}
        blocked={blocked}
        device={device}
        title={t("معاينة شريط الإعلانات", "Announcement bar preview")}
        onLoad={notifyLoaded}
        onRetry={reload}
      />
    </div>
  );
}

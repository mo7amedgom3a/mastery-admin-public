import { useMemo, useState } from "react";
import { ExternalLink, Monitor, Smartphone } from "lucide-react";

import type { BlogDocument } from "@/lib/api";
import { useT } from "@/lib/i18n";
import {
  STOREFRONT_ORIGIN,
  usePreviewChannel,
  type PreviewDevice,
} from "@/features/learning/studio/preview/use-preview-channel";
import { StorefrontViewport } from "@/features/learning/studio/preview/storefront-frame";

/**
 * Live preview: the storefront's blog post page (`mastery-front /preview/blog`) in an iframe. The studio posts the
 * draft document (and the post's preview base) on every change. The "open in a new tab" link loads the saved draft
 * by slug, so the editor's unsaved changes are not in it.
 */
export function BlogPreviewFrame({
  slug,
  base,
  document,
}: {
  slug: string;
  base: unknown;
  document: BlogDocument;
}) {
  const t = useT();
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const message = useMemo(
    () => ({ type: "render", kind: "blog-post", base, document }),
    [base, document],
  );
  const { frameRef, url, ready, blocked, reload, notifyLoaded } = usePreviewChannel("/preview/blog", message);
  const openUrl = `${STOREFRONT_ORIGIN.replace(/\/$/, "")}/preview/blog?slug=${encodeURIComponent(slug)}`;

  return (
    <div className="ma-blog-preview">
      <div className="ma-blog-preview__bar">
        <div className="ma-seg" role="group" aria-label={t("جهاز المعاينة", "Preview device")}>
          <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title={t("سطح المكتب", "Desktop")}>
            <Monitor size={16} aria-hidden />
          </button>
          <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title={t("الجوال", "Mobile")}>
            <Smartphone size={16} aria-hidden />
          </button>
        </div>
        <a className="ma-sblock__btn" href={openUrl} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} aria-hidden />
          {t("فتح في تبويب جديد", "Open in a new tab")}
        </a>
      </div>
      <StorefrontViewport
        frameRef={frameRef}
        url={url}
        ready={ready}
        blocked={blocked}
        device={device}
        title={t("معاينة مقال المدونة", "Blog post preview")}
        onLoad={notifyLoaded}
        onRetry={reload}
      />
    </div>
  );
}

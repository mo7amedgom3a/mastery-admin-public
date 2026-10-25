import type { RefObject } from "react";

import { useT } from "@/lib/i18n";

import { STOREFRONT_ORIGIN, type PreviewDevice } from "./use-preview-channel";

/** The framed storefront page (from `usePreviewChannel`) at desktop or phone width, with a loading / unreachable state. */
export function StorefrontViewport({
  frameRef,
  url,
  ready,
  blocked,
  device,
  title,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  url: string;
  ready: boolean;
  blocked: boolean;
  device: PreviewDevice;
  title: string;
}) {
  const t = useT();
  return (
    <div className={`ma-studio-preview is-${device}`}>
      <div className="ma-studio-preview__viewport">
        <iframe ref={frameRef} src={url} title={title} className="ma-studio-preview__frame" sandbox="allow-scripts allow-same-origin" />
        {!ready ? (
          <div className="ma-studio-preview__state" role="status">
            {blocked
              ? t(`تعذّر تحميل المعاينة من ${STOREFRONT_ORIGIN}`, `Couldn't load the preview from ${STOREFRONT_ORIGIN}`)
              : t("جارٍ تحميل المعاينة…", "Loading preview…")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

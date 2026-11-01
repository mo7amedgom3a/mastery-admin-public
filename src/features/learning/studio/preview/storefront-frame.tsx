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
  onLoad,
  onRetry,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  url: string;
  ready: boolean;
  blocked: boolean;
  device: PreviewDevice;
  title: string;
  /** The frame finished loading: ask it for a fresh handshake. */
  onLoad?: () => void;
  /** Shown with the unreachable state; remounts the frame. */
  onRetry?: () => void;
}) {
  const t = useT();
  return (
    <div className={`ma-studio-preview is-${device}`}>
      <div className="ma-studio-preview__viewport">
        <iframe
          ref={frameRef}
          src={url}
          title={title}
          className="ma-studio-preview__frame"
          sandbox="allow-scripts allow-same-origin"
          onLoad={onLoad}
        />
        {!ready ? (
          <div className="ma-studio-preview__state" role="status">
            {blocked ? (
              <div className="flex flex-col items-center gap-3">
                <span>{t(`تعذّر تحميل المعاينة من ${STOREFRONT_ORIGIN}`, `Couldn't load the preview from ${STOREFRONT_ORIGIN}`)}</span>
                {onRetry ? (
                  <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" onClick={onRetry}>
                    {t("إعادة المحاولة", "Retry")}
                  </button>
                ) : null}
              </div>
            ) : (
              t("جارٍ تحميل المعاينة…", "Loading preview…")
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

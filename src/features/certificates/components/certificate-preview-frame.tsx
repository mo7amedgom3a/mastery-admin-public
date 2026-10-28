import { useEffect, useRef, useState } from "react";

import { renderCertificatePreview, type CertificatePreviewInput } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { ErrorAlert } from "@/components/ui/kit";

/** A4 landscape at 96 dpi: the size the certificate HTML is laid out at. */
const PAGE_WIDTH = 1123;
const PAGE_HEIGHT = 794;
const DEBOUNCE_MS = 300;

/**
 * Live certificate preview. The draft settings are rendered by the backend with the same template the issued
 * PDF is printed from (so what the admin sees is what customers get), then shown in a sandboxed `srcdoc`
 * iframe scaled to the panel width. Requests are debounced and the previous one is aborted.
 */
export function CertificatePreviewFrame({
  productRef,
  input,
}: {
  productRef: string;
  input: CertificatePreviewInput;
}) {
  const t = useT();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.5);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const serialized = JSON.stringify(input);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PAGE_WIDTH));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      renderCertificatePreview(productRef, JSON.parse(serialized) as CertificatePreviewInput, controller.signal)
        .then((next) => {
          setHtml(next);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setError(err);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [productRef, serialized]);

  return (
    <div>
      <div
        ref={wrapRef}
        className="ma-cert-preview"
        style={{
          position: "relative",
          width: "100%",
          height: PAGE_HEIGHT * scale,
          overflow: "hidden",
          borderRadius: 8,
          border: "1px solid var(--line, #e5e5ea)",
          background: "#fff",
          boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        }}
      >
        {html ? (
          <iframe
            title={t("معاينة الشهادة", "Certificate preview")}
            srcDoc={html}
            sandbox=""
            style={{
              width: PAGE_WIDTH,
              height: PAGE_HEIGHT,
              border: 0,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              position: "absolute",
              left: 0,
              top: 0,
              opacity: loading ? 0.6 : 1,
              transition: "opacity .15s",
            }}
          />
        ) : null}
        {loading && !html ? (
          <div className="ma-studio-preview__state" role="status">
            {t("جارٍ تحميل المعاينة…", "Loading preview…")}
          </div>
        ) : null}
      </div>
      <ErrorAlert error={error} title={t("تعذّر عرض المعاينة", "Couldn't render the preview")} />
    </div>
  );
}

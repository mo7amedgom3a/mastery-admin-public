import { useEffect, useMemo } from "react";

import type { PreviewKind, StudioDocument } from "@/lib/api";
import { useT } from "@/lib/i18n";

import { StorefrontViewport } from "./storefront-frame";
import { usePreviewChannel, type PreviewDevice } from "./use-preview-channel";

/*
 * Live preview: the storefront's real product page (mastery-front `/preview/product`) in an iframe. The studio
 * posts the draft (and the product's storefront data) on every change.
 */

export type { PreviewDevice } from "./use-preview-channel";

export function PreviewFrame({
  base,
  document,
  kind,
  device,
  focusBlockId,
  readme,
}: {
  base: unknown;
  document: StudioDocument;
  kind: PreviewKind;
  device: PreviewDevice;
  /** Scrolls the preview to this block (outline clicks). */
  focusBlockId?: { id: string; at: number } | null;
  /** The product README (markdown) being edited; the storefront renders it live in place of the about sections. */
  readme?: string | null;
}) {
  const t = useT();
  const message = useMemo(
    () => ({ type: "render", kind, base, document, readme: readme ?? null }),
    [kind, base, document, readme],
  );
  const { frameRef, url, ready, blocked, post } = usePreviewChannel("/preview/product", message);

  useEffect(() => {
    if (!ready || !focusBlockId) return;
    post({ type: "scroll", blockId: focusBlockId.id });
  }, [ready, post, focusBlockId]);

  return (
    <StorefrontViewport frameRef={frameRef} url={url} ready={ready} blocked={blocked} device={device}
      title={t("معاينة صفحة الدورة", "Course page preview")} />
  );
}

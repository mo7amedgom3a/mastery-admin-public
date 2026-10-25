import { useMemo } from "react";

import { useT } from "@/lib/i18n";
import { StorefrontViewport } from "@/features/learning/studio/preview/storefront-frame";
import { usePreviewChannel, type PreviewDevice } from "@/features/learning/studio/preview/use-preview-channel";

/**
 * The storefront's real expert page (mastery-front `/preview/expert/{key}`, read uncached) in an iframe.
 * `blocks` (the Studio page) and `readme`, when given, are posted on every change and drive its about section live.
 */
export function ExpertPreview({
  expertKey,
  readme,
  blocks,
  device,
}: {
  expertKey: string;
  readme?: string | null;
  /** The Studio page being built; sent with every change (empty: no built page). */
  blocks?: unknown[] | null;
  device: PreviewDevice;
}) {
  const t = useT();
  const message = useMemo(() => ({ type: "render", readme: readme ?? null, blocks: blocks ?? null }), [readme, blocks]);
  const { frameRef, url, ready, blocked } = usePreviewChannel(`/preview/expert/${encodeURIComponent(expertKey)}`, message);
  return (
    <StorefrontViewport
      frameRef={frameRef}
      url={url}
      ready={ready}
      blocked={blocked}
      device={device}
      title={t("معاينة صفحة المدرّب", "Expert page preview")}
    />
  );
}

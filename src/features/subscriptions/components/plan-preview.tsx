import { useMemo, useState } from "react";
import { Monitor, Smartphone } from "lucide-react";

import type { SubscriptionPlanPreview } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Button, Card } from "@/components/ui/kit";
import { StorefrontViewport } from "@/features/learning/studio/preview/storefront-frame";
import { usePreviewChannel, type PreviewDevice } from "@/features/learning/studio/preview/use-preview-channel";

/*
 * Live storefront preview of a plan: mastery-front `/preview/subscription` renders the real plan card or plan page
 * from the plan we post (the public `GET /subscriptions/plans/{slug}` shape), re-posted on every change.
 */

export type PlanPreviewView = "card" | "page";

export function PlanPreviewPanel({ plan }: { plan: SubscriptionPlanPreview | undefined }) {
  const t = useT();
  const [view, setView] = useState<PlanPreviewView>("card");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const message = useMemo(() => (plan ? { type: "render", kind: "subscription", view, plan } : null), [plan, view]);
  const { frameRef, url, ready, blocked } = usePreviewChannel("/preview/subscription", message);

  return (
    <Card
      title={t("المعاينة الحية", "Live preview")}
      actions={
        <span className="ma-cell-flex" style={{ gap: "var(--space-1)", flexWrap: "wrap" }}>
          <Button sm kind={view === "card" ? "secondary" : "soft"} label={t("البطاقة", "Card")} onClick={() => setView("card")} />
          <Button sm kind={view === "page" ? "secondary" : "soft"} label={t("صفحة الباقة", "Plan page")} onClick={() => setView("page")} />
          <span className="ma-seg" role="group" aria-label={t("جهاز المعاينة", "Preview device")}>
            <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title={t("سطح المكتب", "Desktop")}>
              <Monitor size={16} aria-hidden />
            </button>
            <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title={t("الجوال", "Mobile")}>
              <Smartphone size={16} aria-hidden />
            </button>
          </span>
        </span>
      }
    >
      <StorefrontViewport frameRef={frameRef} url={url} ready={ready} blocked={blocked} device={device}
        title={t("معاينة الباقة على الموقع", "Plan preview on the site")} />
      <p className="ma-help" style={{ marginBlockStart: "var(--space-2)" }}>
        {t(
          "هكذا تظهر الباقة للعملاء بالعربية. التغييرات غير المحفوظة تظهر فورًا؛ زر الاشتراك معطّل في المعاينة.",
          "This is how customers see the plan (in Arabic). Unsaved changes show right away; the subscribe button is disabled in the preview.",
        )}
      </p>
    </Card>
  );
}

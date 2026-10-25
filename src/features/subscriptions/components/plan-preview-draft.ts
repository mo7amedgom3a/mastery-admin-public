import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { SubscriptionPlanPreview } from "@/lib/api";

/*
 * On the plan page each editing tab reports its unsaved state as a patch over the saved plan (storefront shape),
 * so the live preview follows every keystroke before anything is saved. Only one tab is open at a time.
 */

export type PlanPreviewPatch = Partial<SubscriptionPlanPreview>;

type DraftContext = { setPatch: (patch: PlanPreviewPatch | null) => void };
export const PlanPreviewDraft = createContext<DraftContext | null>(null);

/** Holds the open tab's unsaved patch and merges it over the saved plan for the preview. */
export function usePlanPreviewDraft(base: SubscriptionPlanPreview | undefined) {
  const [patch, setPatch] = useState<PlanPreviewPatch | null>(null);
  const context = useMemo<DraftContext>(() => ({ setPatch }), []);
  const plan = useMemo(() => (base ? { ...base, ...(patch ?? {}) } : undefined), [base, patch]);
  return { plan, context };
}

/** Report this tab's unsaved changes to the live preview; cleared when the tab closes. */
export function usePlanPreviewPatch(patch: PlanPreviewPatch) {
  const draft = useContext(PlanPreviewDraft);
  const key = JSON.stringify(patch);
  useEffect(() => {
    draft?.setPatch(JSON.parse(key) as PlanPreviewPatch);
  }, [draft, key]);
  useEffect(() => () => draft?.setPatch(null), [draft]);
}

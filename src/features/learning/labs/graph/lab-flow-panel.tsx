import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { buildLabGraph, type LabGraphInput } from "@/lib/api";
import { useT } from "@/lib/i18n";

import { WorkflowCanvas } from "./workflow-canvas";
import { useGraphPreview } from "./use-graph-preview";
import type { FlowNode } from "./types";

type Props = {
  labId: string;
  definition: Record<string, unknown>;
  dirty: boolean;
  onTab: (tab: string) => void;
  onScenario: (scenarioId: string) => void;
};

/** Lab Studio → Flow: authoring lifecycle, phases, scenarios and the pinned engine. */
export function LabFlowPanel({ labId, definition, dirty, onTab, onScenario }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const build = useCallback(
    (payload: LabGraphInput, signal: AbortSignal) => buildLabGraph(labId, payload, signal),
    [labId],
  );
  const payload: LabGraphInput = {
    scope: "lab",
    definition: dirty ? definition : null,
  };
  const { graph, pending, error, reload } = useGraphPreview({ build, payload });

  const handleAction = useCallback(
    (node: FlowNode) => {
      const link = node.link;
      if (!link) return;
      if (link.href) {
        navigate(link.href);
        return;
      }
      if (link.scenario_id) {
        onScenario(link.scenario_id);
        return;
      }
      if (link.tab) onTab(link.tab);
    },
    [navigate, onScenario, onTab],
  );

  return (
    <>
      <p className="ma-help">
        {t(
          "يعرض المخطط حالة المختبر والمراحل والسيناريوهات والمحرّك المثبّت. كل شيء للقراءة فقط؛ انقر سيناريو لفتحه أو عقدة حالة للانتقال إلى تبويبها.",
          "The graph shows the lab lifecycle, phases, scenarios and the pinned engine. It is read-only: click a scenario to edit it, or a state node to jump to its tab.",
        )}
      </p>
      <WorkflowCanvas
        title={t("دورة حياة المختبر", "Lab flow")}
        graph={graph}
        pending={pending}
        error={error}
        onReload={reload}
        onAction={handleAction}
        height={560}
        emptyText={t("لا عقد لهذا المختبر بعد.", "This lab has no nodes yet.")}
      />
    </>
  );
}

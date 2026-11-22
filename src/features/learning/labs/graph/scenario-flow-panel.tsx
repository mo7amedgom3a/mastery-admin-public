import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import { buildLabGraph, type LabGraphInput } from "@/lib/api";
import { useT } from "@/lib/i18n";

import { WorkflowCanvas } from "./workflow-canvas";
import { useGraphPreview } from "./use-graph-preview";
import type { FlowNode, NodeFocus } from "./types";

type Props = {
  labId: string;
  scenarioId: string;
  title: string;
  content: Record<string, unknown>;
  dirty: boolean;
  height?: number;
  onFocus?: (focus: NodeFocus) => void;
};

/** Scenario workflow for the live editor: dialogue pipeline/nodes, pathways and block pages. */
export function ScenarioFlowPanel({
  labId,
  scenarioId,
  title,
  content,
  dirty,
  height = 520,
  onFocus,
}: Props) {
  const t = useT();
  const navigate = useNavigate();
  const build = useCallback(
    (payload: LabGraphInput, signal: AbortSignal) => buildLabGraph(labId, payload, signal),
    [labId],
  );
  const payload: LabGraphInput = {
    scope: "scenario",
    scenario_id: scenarioId,
    content: dirty ? content : null,
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
      onFocus?.({
        stageId: link.stage_id ?? undefined,
        nodeId: link.node_id ?? undefined,
        pageId: link.page_id ?? undefined,
        blockId: link.block_id ?? undefined,
      });
    },
    [navigate, onFocus],
  );

  return (
    <WorkflowCanvas
      title={title}
      graph={graph}
      pending={pending}
      error={error}
      onReload={reload}
      onAction={handleAction}
      height={height}
      emptyText={t("لا عقد لهذا السيناريو بعد.", "This scenario has no nodes yet.")}
    />
  );
}

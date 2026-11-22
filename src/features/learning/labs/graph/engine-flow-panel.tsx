import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

import {
  buildEngineGraph,
  type EngineDefinitionDoc,
  type EngineGraphInput,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

import { WorkflowCanvas } from "./workflow-canvas";
import { useGraphPreview } from "./use-graph-preview";
import type { FlowNode } from "./types";

type Props = {
  engineId: string;
  definition: EngineDefinitionDoc;
  dirty: boolean;
  onTab: (tab: string) => void;
};

/** Engine Studio → Flow: lifecycle, versions, lab usage and the starter pipeline. */
export function EngineFlowPanel({ engineId, definition, dirty, onTab }: Props) {
  const t = useT();
  const navigate = useNavigate();
  const build = useCallback(
    (payload: EngineGraphInput, signal: AbortSignal) => buildEngineGraph(engineId, payload, signal),
    [engineId],
  );
  const payload: EngineGraphInput = {
    definition: dirty ? (definition as unknown as Record<string, unknown>) : null,
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
      if (link.tab) onTab(link.tab);
    },
    [navigate, onTab],
  );

  return (
    <>
      <p className="ma-help">
        {t(
          "هذا مخطط للقراءة فقط: يتحرك مع المسودة غير المحفوظة ولا ينشر شيئًا. اختر عقدة لعرض تفاصيلها، واستخدم زر الفتح للانتقال إلى تبويبها.",
          "This is a read-only projection: it follows the unsaved draft and never publishes anything. Select a node for details, then use Open to jump to its tab.",
        )}
      </p>
      <WorkflowCanvas
        title={t("دورة حياة المحرّك", "Engine lifecycle")}
        graph={graph}
        pending={pending}
        error={error}
        onReload={reload}
        onAction={handleAction}
        height={560}
        emptyText={t("لا عقد لهذا المحرّك بعد.", "This engine has no nodes yet.")}
      />
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Edge,
  type XYPosition,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useLang, useT } from "@/lib/i18n";
import { resolvedTheme, useThemeStore } from "@/lib/theme";
import { Alert, Badge, Button, Empty, Loading } from "@/components/ui/kit";
import { Icon } from "@/components/ui/icon";

import { STATUS_LABELS, textOf } from "./graph-model";
import { WorkflowNode } from "./workflow-node";
import {
  defaultExpanded,
  toFlow,
  type WorkflowFlowNode,
} from "./flow-layout";
import type { FlowGraph, FlowNode } from "./types";
import "./graph.css";

const NODE_TYPES = { maGraphNode: WorkflowNode };

type Props = {
  graph: FlowGraph | null;
  title?: string;
  height?: number;
  pending?: boolean;
  error?: Error | null;
  onReload?: () => void;
  onAction?: (node: FlowNode) => void;
  emptyText?: string;
  className?: string;
};

/** A read-only, interactive rendering of a `GraphOut` projection. */
export function WorkflowCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <CanvasBody {...props} />
    </ReactFlowProvider>
  );
}

function CanvasBody({
  graph,
  title,
  height = 540,
  pending = false,
  error = null,
  onReload,
  onAction,
  emptyText,
  className,
}: Props) {
  const t = useT();
  const lang = useLang();
  const colorMode = resolvedTheme(useThemeStore((state) => state.theme));
  const { fitView } = useReactFlow<WorkflowFlowNode, Edge>();
  const nodesInitialized = useNodesInitialized();
  const [expanded, setExpanded] = useState<Set<string>>(() => defaultExpanded(graph));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fitToken, setFitToken] = useState(0);
  const [full, setFull] = useState(false);
  const [dragged, setDragged] = useState<Map<string, XYPosition>>(() => new Map());
  const knownGroups = useRef<Set<string>>(new Set());
  const graphId = useRef<string | null>(null);

  const toggleGroup = useCallback((groupId: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
    setFitToken((value) => value + 1);
  }, []);

  const activate = useCallback(
    (node: FlowNode) => {
      if (node.link) {
        onAction?.(node);
        return;
      }
      if (node.expand_group) toggleGroup(node.expand_group);
    },
    [onAction, toggleGroup],
  );

  const layout = useMemo(
    () =>
      toFlow(graph, expanded, lang, dragged, {
        onToggleGroup: toggleGroup,
        onActivate: activate,
      }),
    [activate, dragged, expanded, graph, lang, toggleGroup],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>([]);
  const edges = layout.edges;

  useEffect(() => {
    setNodes(layout.nodes);
  }, [layout, setNodes]);

  // A new graph (another engine/lab/scenario) resets expansion and dragged positions; a rebuild
  // of the same graph keeps both so typing does not throw the viewport around.
  useEffect(() => {
    if (!graph) return;
    if (graphId.current !== graph.graph_id) {
      graphId.current = graph.graph_id;
      setDragged(new Map());
      knownGroups.current = new Set((graph.groups ?? []).map((group) => group.id));
      setExpanded(defaultExpanded(graph));
      setSelectedId(null);
      setFitToken((value) => value + 1);
      return;
    }
    setExpanded((previous) => {
      let changed = false;
      const next = new Set(previous);
      for (const group of graph.groups ?? []) {
        if (knownGroups.current.has(group.id)) continue;
        knownGroups.current.add(group.id);
        if (!group.collapsed_by_default) {
          next.add(group.id);
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [graph]);

  const graphIdForFit = graph?.graph_id ?? null;
  const layoutNodeCount = layout.nodes.length;
  useEffect(() => {
    if (!graphIdForFit || !layoutNodeCount || !nodesInitialized) return;
    const timer = window.setTimeout(() => {
      void fitView({ padding: "6%", duration: 240 });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [fitToken, fitView, graphIdForFit, layoutNodeCount, nodesInitialized]);

  useEffect(() => {
    if (!full) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFull(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [full]);

  const selected = useMemo(
    () => (graph?.nodes ?? []).find((node) => node.id === selectedId) ?? null,
    [graph, selectedId],
  );

  const resetLayout = () => {
    setDragged(new Map());
    setFitToken((value) => value + 1);
  };

  const allGroups = (graph?.groups ?? []).map((group) => group.id);
  const graphValid = graph?.valid ?? true;
  const graphErrors = graph?.errors ?? 0;
  const graphWarnings = graph?.warnings ?? 0;

  return (
    <div className={`ma-flow${full ? " ma-flow--full" : ""}${className ? ` ${className}` : ""}`} data-testid="flow-canvas">
      <div className="ma-flow__bar">
        <span className="ma-flow__summary">
          {title ? <strong className="ma-flow__title" dir="auto">{title}</strong> : null}
          {graph ? (
            <>
              <Badge
                def={
                  graph.source === "draft"
                    ? { label: { ar: "مسودة غير محفوظة", en: "Unsaved draft" }, tone: "info" }
                    : { label: { ar: "محفوظ", en: "Saved" }, tone: "neutral" }
                }
              />
              {graph.revision != null ? <span className="ma-help">r{graph.revision}</span> : null}
              <Badge
                def={
                  graphValid
                    ? { label: { ar: "صالح", en: "Valid" }, tone: "success" }
                    : { label: { ar: `${graphErrors} خطأ`, en: `${graphErrors} error(s)` }, tone: "danger" }
                }
              />
              {graphWarnings ? (
                <Badge def={{ label: { ar: `${graphWarnings} تنبيه`, en: `${graphWarnings} warning(s)` }, tone: "warning" }} />
              ) : null}
              {graph.truncated ? (
                <Badge def={{ label: { ar: "مختصر", en: "Truncated" }, tone: "warning" }} />
              ) : null}
            </>
          ) : null}
          {pending ? (
            <span className="ma-flow__pending" role="status" aria-live="polite">
              <Icon name="refresh" />
              {t("جارٍ التحديث…", "Updating…")}
            </span>
          ) : null}
        </span>
        <span className="ma-flow__tools">
          <Button
            sm
            kind="ghost"
            icon="layers"
            label={t("توسيع الكل", "Expand all")}
            disabled={!allGroups.length}
            onClick={() => {
              setExpanded(new Set(allGroups));
              setFitToken((value) => value + 1);
            }}
          />
          <Button
            sm
            kind="ghost"
            label={t("طيّ الكل", "Collapse all")}
            disabled={!allGroups.length}
            onClick={() => {
              setExpanded(new Set());
              setFitToken((value) => value + 1);
            }}
          />
          <Button sm kind="ghost" icon="refresh" label={t("إعادة الضبط", "Reset layout")} onClick={resetLayout} />
          <Button
            sm
            kind="ghost"
            icon={full ? "x" : "panel"}
            label={full ? t("إغلاق", "Close") : t("تكبير", "Expand")}
            onClick={() => setFull((value) => !value)}
          />
          {onReload ? <Button sm kind="ghost" icon="refresh" label={t("تحديث", "Refresh")} onClick={onReload} /> : null}
        </span>
      </div>

      {error ? (
        <Alert kind="danger" title={t("تعذّر تحديث المخطط", "Could not update the graph")}>
          {error.message}
          {onReload ? (
            <div style={{ marginBlockStart: 6 }}>
              <Button sm kind="soft" label={t("أعد المحاولة", "Retry")} onClick={onReload} />
            </div>
          ) : null}
        </Alert>
      ) : null}

      {graph && graph.messages?.length ? (
        <div className="ma-flow__messages">
          {graph.messages.slice(0, 4).map((message, index) => (
            <span key={index} className={`ma-flow__message ma-flow__message--${message.level}`}>
              {textOf(message.text, t)}
            </span>
          ))}
        </div>
      ) : null}

      <div
        className="ma-flow__viewport"
        style={{ height: full ? "calc(100vh - 230px)" : height }}
        dir="ltr"
      >
        {!graph ? (
          <Loading label={t("جارٍ بناء المخطط…", "Building the graph…")} />
        ) : !nodes.length ? (
          <Empty text={emptyText ?? t("لا عقد لعرضها بعد.", "No nodes to show yet.")} />
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onNodeClick={(_event, node) => setSelectedId(node.id)}
            onNodeDoubleClick={(_event, node) => activate(node.data.node)}
            onNodeDragStop={(_event, node) =>
              setDragged((previous) => {
                const next = new Map(previous);
                next.set(node.id, node.position);
                return next;
              })
            }
            onPaneClick={() => setSelectedId(null)}
            forceColorMode={colorMode}
            fitView={false}
            minZoom={0.2}
            maxZoom={1.8}
            nodesConnectable={false}
            nodesDraggable
            elementsSelectable
            proOptions={{ hideAttribution: false }}
            className="ma-flow__rf"
          >
            <Background gap={22} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable nodeStrokeWidth={2} />
          </ReactFlow>
        )}
      </div>

      <div className="ma-flow__inspector" data-testid="flow-inspector">
        {selected ? (
          <>
            <span className="ma-flow__inspector-title">
              <Icon name="info" />
              <strong dir="auto">{textOf(selected.label, t)}</strong>
              {selected.sublabel ? <span className="ma-help" dir="auto">{textOf(selected.sublabel, t)}</span> : null}
              <Badge def={{ label: STATUS_LABELS[selected.status] ?? STATUS_LABELS.neutral, tone: selected.status }} />
            </span>
            <span className="ma-flow__inspector-actions">
              {selected.link || selected.expand_group ? (
                <Button
                  sm
                  kind="soft"
                  icon="arrowForward"
                  label={selected.link ? t("فتح", "Open") : selected.expand_group && expanded.has(selected.expand_group) ? t("طيّ", "Collapse") : t("توسيع", "Expand")}
                  onClick={() => activate(selected)}
                />
              ) : null}
            </span>
            {selected.description ? (
              <p className="ma-flow__inspector-desc" dir="auto">{textOf(selected.description, t)}</p>
            ) : null}
            {selected.issues?.length ? (
              <ul className="ma-flow__issues">
                {selected.issues.map((issue, index) => (
                  <li key={index} className={`ma-flow__issue--${issue.level}`}>
                    <span>{issue.message}</span>
                    {issue.path ? <bdi>{issue.path}</bdi> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <span className="ma-help">
            {t("اختر عقدة لعرض تفاصيلها، وانقر زر الفتح للانتقال إلى المحرّر.", "Select a node for details; use its Open action to go to the editor.")}
          </span>
        )}
      </div>
    </div>
  );
}

import { MarkerType, Position, type Edge, type Node, type XYPosition } from "@xyflow/react";

import { translate, type Lang } from "@/lib/i18n";

import { edgeColor, edgeDash, edgeWidth } from "./graph-model";
import type { FlowGraph, FlowNode } from "./types";

export const NODE_WIDTH = 210;
export const NODE_HEIGHT = 90;
export const COLUMN_GAP = 36;
export const ROW_GAP = 12;
export const LANE_GAP = 36;

export type WorkflowNodeData = {
  node: FlowNode;
  canExpand: boolean;
  expanded: boolean;
  onToggleGroup: (groupId: string) => void;
  onActivate: (node: FlowNode) => void;
};

export type WorkflowFlowNode = Node<WorkflowNodeData, "maGraphNode">;

export type LayoutCallbacks = {
  onToggleGroup: (groupId: string) => void;
  onActivate: (node: FlowNode) => void;
};

function placedPosition(node: FlowNode, laneY: Map<number, number>): XYPosition {
  const lane = node.lane ?? 0;
  return {
    x: (node.column ?? 0) * (NODE_WIDTH + COLUMN_GAP),
    y: (laneY.get(lane) ?? 0) + (node.order ?? 0) * (NODE_HEIGHT + ROW_GAP),
  };
}

/**
 * Turn the API graph into React Flow nodes and edges.
 *
 * The server owns rank/lane/order; this function only turns them into coordinates. Dragged
 * positions override the computed ones per node. Nodes inside a collapsed group are hidden, and
 * edges touching a hidden node are dropped so the canvas never shows a dangling line.
 */
export function toFlow(
  graph: FlowGraph | null,
  expanded: Set<string>,
  lang: Lang,
  dragged: Map<string, XYPosition>,
  callbacks: LayoutCallbacks,
): { nodes: WorkflowFlowNode[]; edges: Edge[] } {
  if (!graph) return { nodes: [], edges: [] };
  const visible = (graph.nodes ?? []).filter((node) => !node.group || expanded.has(node.group));
  const visibleIds = new Set(visible.map((node) => node.id));

  const rowsByLane = new Map<number, number>();
  for (const node of visible) {
    const lane = node.lane ?? 0;
    rowsByLane.set(lane, Math.max(rowsByLane.get(lane) ?? 0, (node.order ?? 0) + 1));
  }
  const laneY = new Map<number, number>();
  let cursor = 0;
  for (const lane of [...rowsByLane.keys()].sort((a, b) => a - b)) {
    if (lane > 0) cursor += LANE_GAP;
    laneY.set(lane, cursor);
    cursor += Math.max(1, rowsByLane.get(lane) ?? 1) * (NODE_HEIGHT + ROW_GAP);
  }

  const nodes: WorkflowFlowNode[] = visible.map((node) => {
    const canExpand = Boolean(node.expand_group && (node.count ?? 0) > 0);
    return {
      id: node.id,
      type: "maGraphNode",
      position: dragged.get(node.id) ?? placedPosition(node, laneY),
      width: NODE_WIDTH,
      data: {
        node,
        canExpand,
        expanded: Boolean(node.expand_group && expanded.has(node.expand_group)),
        onToggleGroup: callbacks.onToggleGroup,
        onActivate: callbacks.onActivate,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: true,
      selectable: true,
      deletable: false,
      connectable: false,
      className: `ma-flow-node ma-flow-node--${node.status} ma-flow-node--${node.kind}`,
    };
  });

  const edges: Edge[] = (graph.edges ?? [])
    .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    .map((edge) => {
      const color = edgeColor(edge);
      const label = edge.label && edge.kind !== "next"
        ? translate(lang, edge.label.ar, edge.label.en ?? undefined)
        : undefined;
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "default",
        label,
        animated: edge.animated,
        className: `ma-flow-edge ma-flow-edge--${edge.kind} ma-flow-edge--${edge.tone}`,
        style: {
          stroke: color,
          strokeWidth: edgeWidth(edge),
          strokeDasharray: edgeDash(edge),
        },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
        labelStyle: { fill: "var(--text)", fontSize: 12.5, fontFamily: "var(--font-sans)" },
        labelBgStyle: { fill: "var(--surface)", fillOpacity: 0.93 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        interactionWidth: 10,
      } satisfies Edge;
    });

  return { nodes, edges };
}

export function defaultExpanded(graph: FlowGraph | null): Set<string> {
  const next = new Set<string>();
  for (const group of graph?.groups ?? []) {
    if (!group.collapsed_by_default) next.add(group.id);
  }
  return next;
}

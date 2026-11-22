import type { LabGraph } from "@/lib/api";

/** Shared aliases for the graph projection returned by the labs API. */
export type FlowGraph = LabGraph;
export type FlowNode = NonNullable<FlowGraph["nodes"]>[number];
export type FlowEdge = NonNullable<FlowGraph["edges"]>[number];
export type FlowGroup = NonNullable<FlowGraph["groups"]>[number];
export type FlowText = FlowNode["label"];
export type FlowBadge = NonNullable<FlowNode["badges"]>[number];
export type FlowIssue = NonNullable<FlowNode["issues"]>[number];
export type FlowAction = (node: FlowNode) => void;

/** Where a scenario node wants the editor to focus after the canvas is clicked. */
export type NodeFocus = {
  stageId?: string;
  nodeId?: string;
  pageId?: string;
  blockId?: string;
};

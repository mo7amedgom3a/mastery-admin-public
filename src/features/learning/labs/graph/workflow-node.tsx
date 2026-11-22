import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import { useT } from "@/lib/i18n";
import { Badge } from "@/components/ui/kit";
import { Icon } from "@/components/ui/icon";

import { badgeOf, nodeIcon, textOf } from "./graph-model";
import type { WorkflowFlowNode } from "./flow-layout";

function WorkflowNodeCard({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const t = useT();
  const node = data.node;
  const label = textOf(node.label, t);
  const sublabel = textOf(node.sublabel, t);
  const description = textOf(node.description, t);
  const badges = (node.badges ?? []).slice(0, 3);
  const extraBadges = Math.max(0, (node.badges?.length ?? 0) - badges.length);
  const errors = (node.issues ?? []).filter((issue) => issue.level === "error").length;
  const warnings = (node.issues ?? []).length - errors;

  return (
    <div
      className={`ma-flow-node__card${selected ? " is-selected" : ""}`}
      data-testid="flow-node"
      data-node-kind={node.kind}
      data-node-status={node.status}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} className="ma-flow-node__handle" />
      <div className="ma-flow-node__head">
        <span className="ma-flow-node__icon" aria-hidden="true">
          <Icon name={nodeIcon(node.kind)} />
        </span>
        <span className="ma-flow-node__title" dir="auto" title={description || label}>
          {label || node.id}
        </span>
        <span className={`ma-flow-node__status ma-flow-node__status--${node.status}`} title={node.status} aria-hidden="true" />
      </div>

      {sublabel ? (
        <span className="ma-flow-node__sub" dir="auto">
          {sublabel}
        </span>
      ) : null}

      {badges.length || errors || warnings ? (
        <span className="ma-flow-node__badges">
          {badges.map((badge, index) => (
            <Badge key={`${badge.label.ar}-${index}`} def={badgeOf(badge)} />
          ))}
          {extraBadges ? <span className="ma-flow-node__more">+{extraBadges}</span> : null}
          {errors ? <Badge def={{ label: { ar: `${errors} خطأ`, en: `${errors} error` }, tone: "danger" }} /> : null}
          {warnings ? <Badge def={{ label: { ar: `${warnings} تنبيه`, en: `${warnings} warn` }, tone: "warning" }} /> : null}
        </span>
      ) : null}

      {(data.canExpand || node.link) ? (
        <span className="ma-flow-node__actions">
          {data.canExpand ? (
            <button
              type="button"
              className="ma-flow-node__action"
              aria-expanded={data.expanded}
              aria-label={
                data.expanded
                  ? t("اطوِ التفاصيل", "Collapse details")
                  : t("اعرض التفاصيل", "Expand details")
              }
              onClick={(event) => {
                event.stopPropagation();
                if (node.expand_group) data.onToggleGroup(node.expand_group);
              }}
            >
              <Icon name="chevron" className={data.expanded ? "is-open" : undefined} />
              {node.count ? <span>{node.count}</span> : null}
            </button>
          ) : null}
          {node.link ? (
            <button
              type="button"
              className="ma-flow-node__action"
              aria-label={t("فتح", "Open")}
              onClick={(event) => {
                event.stopPropagation();
                data.onActivate(node);
              }}
            >
              <Icon name="arrowForward" />
            </button>
          ) : null}
        </span>
      ) : null}
      <Handle type="source" position={Position.Right} isConnectable={false} className="ma-flow-node__handle" />
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeCard);

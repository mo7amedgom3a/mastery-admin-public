import { useId } from "react";

import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/kit";

import { CONTEXT_PATHS, type Condition, type ConditionOp } from "../engine-model";

const OPS: [ConditionOp, string][] = [
  ["eq", "="],
  ["neq", "≠"],
  ["gt", ">"],
  ["gte", "≥"],
  ["lt", "<"],
  ["lte", "≤"],
  ["in", "∈"],
  ["contains", "∋"],
  ["exists", "∃"],
];

type Structured = { left: string; op: ConditionOp; right?: unknown };

const SYMBOL: Record<string, ConditionOp> = { ">=": "gte", "<=": "lte", "==": "eq", "!=": "neq", ">": "gt", "<": "lt" };

/** String expressions (`meters.trust >= 60`) are shown as rows too. */
function toStructured(condition: Condition): Structured {
  if (typeof condition !== "string") return condition;
  const match = condition.trim().match(/^([\w.-]+)\s*(>=|<=|==|!=|>|<)\s*(.+)$/);
  if (!match) return { left: condition, op: "exists" };
  return { left: match[1], op: SYMBOL[match[2]], right: parseValue(match[3].replace(/^["']|["']$/g, "")) };
}

function parseValue(text: string): unknown {
  const value = text.trim();
  if (value === "") return "";
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((item) => String(item)).join(", ");
  if (value === null) return "null";
  if (value === undefined) return "";
  return String(value);
}

/**
 * A list of conditions that must all hold (AND). Values are typed from the text: numbers,
 * `true`/`false`/`null`, or text; `∈` takes a comma-separated list.
 */
export function ConditionEditor({
  value,
  onChange,
  label,
  hint,
  suggestions = [],
  readOnly = false,
}: {
  value: Condition[] | undefined;
  onChange: (next: Condition[]) => void;
  label?: string;
  hint?: string;
  /** Extra context paths for autocomplete (meters, facts, tags of this scenario). */
  suggestions?: string[];
  readOnly?: boolean;
}) {
  const t = useT();
  const listId = useId();
  const rows = (value ?? []).map(toStructured);
  const set = (index: number, patch: Partial<Structured>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const paths = [...new Set([...suggestions, ...CONTEXT_PATHS])];

  return (
    <div className="ma-field">
      {label ? <span className="ma-label">{label}</span> : null}
      <datalist id={listId}>
        {paths.map((path) => (
          <option key={path} value={path} />
        ))}
      </datalist>
      {rows.length ? (
        <div style={{ display: "grid", gap: 6 }}>
          {rows.map((row, index) => (
            <div key={index} className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
              <input
                className="ma-input"
                dir="ltr"
                list={listId}
                aria-label={t("المسار", "Path")}
                style={{ flex: "2 1 12rem", minWidth: 0 }}
                value={row.left}
                disabled={readOnly}
                onChange={(event) => set(index, { left: event.target.value })}
              />
              <select
                className="ma-input"
                aria-label={t("المقارنة", "Operator")}
                style={{ flex: "0 0 7rem" }}
                value={row.op}
                disabled={readOnly}
                onChange={(event) => set(index, { op: event.target.value as ConditionOp })}
              >
                {OPS.map(([op, symbol]) => (
                  <option key={op} value={op}>
                    {symbol} {op}
                  </option>
                ))}
              </select>
              {row.op !== "exists" ? (
                <input
                  className="ma-input"
                  dir="ltr"
                  aria-label={t("القيمة", "Value")}
                  style={{ flex: "1 1 8rem", minWidth: 0 }}
                  value={formatValue(row.right)}
                  disabled={readOnly}
                  onChange={(event) =>
                    set(index, {
                      right: row.op === "in" ? event.target.value.split(",").map((item) => parseValue(item)).filter((item) => item !== "") : parseValue(event.target.value),
                    })
                  }
                />
              ) : null}
              {!readOnly ? (
                <Button sm kind="ghost" icon="trash" label={t("حذف", "Remove")} onClick={() => onChange(rows.filter((_, i) => i !== index))} />
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <span className="ma-help">{t("بلا شروط (يتحقق دائمًا).", "No conditions (always true).")}</span>
      )}
      {!readOnly ? (
        <div>
          <Button sm kind="soft" icon="plus" label={t("شرط", "Condition")} onClick={() => onChange([...rows, { left: "", op: "eq", right: "" }])} />
        </div>
      ) : null}
      {hint ? <span className="ma-help">{hint}</span> : null}
    </div>
  );
}

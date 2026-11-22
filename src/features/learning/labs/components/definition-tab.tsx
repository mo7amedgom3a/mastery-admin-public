/* oxlint-disable react/only-export-components -- the section helper belongs with the tab */
import { useT } from "@/lib/i18n";
import { Card } from "@/components/ui/kit";

import { SchemaForm, type JsonSchema, type SchemaIssue } from "../schema-form";

/** Render the properties of the lab definition schema that belong to one Studio tab. */
export function sectionSchema(schema: JsonSchema | undefined, keys: string[]): JsonSchema {
  const base = schema ?? { type: "object", properties: {} };
  const properties = base.properties ?? {};
  return {
    ...base,
    type: "object",
    properties: Object.fromEntries(Object.entries(properties).filter(([key]) => keys.includes(key))),
    required: (base.required ?? []).filter((key) => keys.includes(key)),
  };
}

export function DefinitionTab({
  title,
  description,
  schema,
  section,
  value,
  onChange,
  issues,
  readOnly = false,
}: {
  title: string;
  description?: string;
  schema: JsonSchema | undefined;
  section: string[];
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  issues: SchemaIssue[];
  readOnly?: boolean;
}) {
  const t = useT();
  const scoped = sectionSchema(schema, section);
  const set = (next: unknown) => onChange(next as Record<string, unknown>);
  return (
    <Card title={title}>
      {description ? <p className="ma-help">{description}</p> : null}
      {readOnly ? (
        <p className="ma-help">{t("قراءة فقط: تحتاج صلاحية تعديل المختبرات.", "Read only: you need the labs write scope.")}</p>
      ) : null}
      <div style={readOnly ? { pointerEvents: "none", opacity: 0.65 } : undefined} aria-disabled={readOnly}>
        <SchemaForm
          schema={scoped}
          value={value}
          onChange={set}
          issues={issues}
          path="/definition"
        />
      </div>
    </Card>
  );
}

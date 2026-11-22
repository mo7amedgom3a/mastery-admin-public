/* oxlint-disable react/only-export-components -- schema helpers and the renderer ship together */
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { useT } from "@/lib/i18n";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/kit";
import { Icon } from "@/components/ui/icon";

/**
 * A small JSON-Schema form renderer for lab documents.
 *
 * It intentionally covers only what the backend emits (Pydantic → JSON Schema): objects, arrays,
 * strings, numbers, integers, booleans, enums, `$ref`/`$defs`, `anyOf`/`oneOf` unions and the
 * `x-widget` / `x-admin-only` hints. Anything else falls back to a raw JSON field, so an unknown
 * schema never loses data.
 */

export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  definitions?: Record<string, JsonSchema>;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  additionalProperties?: boolean | JsonSchema;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  format?: string;
  "x-widget"?: string;
  "x-admin-only"?: boolean;
};

export type SchemaIssue = { path: string; message: string; level: "error" | "warning" | string };

type NodeProps = {
  schema: JsonSchema;
  root: JsonSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  path: string;
  issues: SchemaIssue[];
  label?: string;
  required?: boolean;
  depth?: number;
};

const MAX_DEPTH = 12;

function defsOf(root: JsonSchema): Record<string, JsonSchema> {
  return root.$defs ?? root.definitions ?? {};
}

function resolveRef(ref: string, root: JsonSchema): JsonSchema | undefined {
  const match = /^#\/(?:\$defs|definitions)\/(.+)$/.exec(ref);
  if (!match) return undefined;
  return defsOf(root)[decodeURIComponent(match[1].replace(/~1/g, "/").replace(/~0/g, "~"))];
}

function resolve(schema: JsonSchema | undefined, root: JsonSchema, seen = new Set<string>()): JsonSchema {
  let current = schema ?? {};
  while (current.$ref) {
    if (seen.has(current.$ref)) return {};
    seen.add(current.$ref);
    const next = resolveRef(current.$ref, root);
    if (!next) return {};
    current = next;
  }
  return current;
}

export function humanizeKey(key: string): string {
  const words = key.replace(/[_-]+/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

export function issuesAt(issues: SchemaIssue[], path: string): SchemaIssue[] {
  return issues.filter((issue) => issue.path === path);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function hasType(schema: JsonSchema, type: string): boolean {
  return schema.type === type || (Array.isArray(schema.type) && schema.type.includes(type));
}

/** Wrapper for one labelled property with its inline errors. */
function Wrap({
  label,
  description,
  required,
  admin,
  issues,
  path,
  children,
}: {
  label: string;
  description?: string;
  required?: boolean;
  admin?: boolean;
  issues: SchemaIssue[];
  path: string;
  children: ReactNode;
}) {
  const t = useT();
  const own = issuesAt(issues, path);
  return (
    <div className="ma-field" data-path={path}>
      <span className="ma-label">
        {label}
        {required ? <span aria-hidden="true" className="ma-req"> *</span> : null}
        {admin ? (
          <span className="ma-help" style={{ marginInlineStart: 6 }}>
            {t("إداري فقط", "admin only")}
          </span>
        ) : null}
      </span>
      {description ? <span className="ma-help">{description}</span> : null}
      {children}
      {own.map((issue, index) => (
        <span
          key={`${issue.path}-${index}`}
          className="ma-help"
          style={{ color: issue.level === "error" ? "var(--danger)" : "var(--warning)" }}
        >
          {issue.message}
        </span>
      ))}
    </div>
  );
}

function RawJson({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const t = useT();
  const [text, setText] = useState(() => JSON.stringify(value ?? {}, null, 2));
  const [invalid, setInvalid] = useState<string | null>(null);

  // Keep the editor in sync when the document changes elsewhere (e.g. the raw tab or a restore).
  const incoming = useMemo(() => JSON.stringify(value ?? {}, null, 2), [value]);
  useEffect(() => {
    if (incoming === text) return;
    try {
      if (JSON.stringify(JSON.parse(text)) === JSON.stringify(value ?? {})) return;
    } catch {
      // An unparseable draft is the admin's in-progress text; don't clobber it.
      return;
    }
    setText(incoming);
  }, [incoming, text, value]);

  return (
    <div className="ma-field">
      <textarea
        className="ma-input ma-textarea"
        rows={8}
        dir="ltr"
        spellCheck={false}
        value={text}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          try {
            onChange(JSON.parse(next) as unknown);
            setInvalid(null);
          } catch {
            setInvalid(t("JSON غير صالح", "Invalid JSON"));
          }
        }}
      />
      {invalid ? <span className="ma-help" style={{ color: "var(--danger)" }}>{invalid}</span> : null}
    </div>
  );
}

function UnionField(props: NodeProps) {
  const t = useT();
  const { schema, root, value, onChange } = props;
  // `T | None` is a nullable field, not a real choice: render T alone.
  const branches = (schema.anyOf ?? schema.oneOf ?? [])
    .map((branch) => resolve(branch, root))
    .filter((branch) => !hasType(branch, "null"));
  if (!branches.length) return <RawJson value={value} onChange={onChange} />;
  if (branches.length === 1) return <SchemaNode {...props} schema={branches[0]} />;
  const isString = typeof value === "string" || value === undefined;
  const index = isString ? branches.findIndex((b) => hasType(b, "string")) : branches.findIndex((b) => hasType(b, "object"));
  const selected = index >= 0 ? index : 0;
  const branch = branches[selected] ?? {};
  return (
    <Wrap
      label={props.label ?? schema.title ?? ""}
      description={schema.description}
      required={props.required}
      admin={schema["x-admin-only"]}
      issues={props.issues}
      path={props.path}
    >
      <select
        className="ma-select"
        aria-label={t("نوع القيمة", "Value type")}
        value={String(selected)}
        onChange={(event) => {
          const next = branches[Number(event.target.value)] ?? {};
          if (hasType(next, "string")) onChange("");
          else if (hasType(next, "object")) onChange({});
          else if (hasType(next, "number") || hasType(next, "integer")) onChange(0);
          else if (hasType(next, "boolean")) onChange(false);
          else onChange(null);
        }}
      >
        {branches.map((candidate, candidateIndex) => (
          <option key={candidateIndex} value={candidateIndex}>
            {candidate.title ?? (hasType(candidate, "string") ? t("نص", "Text") : hasType(candidate, "number") ? t("رقم", "Number") : t("كائن", "Object"))}
          </option>
        ))}
      </select>
      <SchemaNode {...props} schema={branch} label={undefined} />
    </Wrap>
  );
}

function SchemaNode(props: NodeProps) {
  const { schema: raw, root, value, onChange, path, issues, label, required, depth = 0 } = props;
  const schema = resolve(raw, root);
  const t = useT();

  if (depth > MAX_DEPTH) return <RawJson value={value} onChange={onChange} />;
  if (schema.anyOf || schema.oneOf) return <UnionField {...props} />;

  const title = label ?? schema.title ?? "";
  const common = { label: title, description: schema.description, required, admin: schema["x-admin-only"], issues, path };

  if (schema.enum) {
    return (
      <Wrap {...common}>
        <select
          className="ma-select"
          value={value == null ? "" : String(value)}
          onChange={(event) => {
            const picked = event.target.value;
            const match = (schema.enum ?? []).find((option) => String(option) === picked);
            onChange(match ?? picked);
          }}
        >
          <option value="">—</option>
          {(schema.enum ?? []).map((option) => (
            <option key={String(option)} value={String(option)}>
              {String(option)}
            </option>
          ))}
        </select>
      </Wrap>
    );
  }

  if (hasType(schema, "boolean")) {
    return (
      <Wrap {...common}>
        <label className="ma-check" style={{ display: "inline-flex", gap: 8, border: 0, background: "none" }}>
          <Checkbox checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked === true)} />
          <span className="ma-help">{title || t("نعم", "Yes")}</span>
        </label>
      </Wrap>
    );
  }

  if (hasType(schema, "integer") || hasType(schema, "number")) {
    return (
      <Wrap {...common}>
        <input
          className="ma-input"
          type="number"
          dir="ltr"
          value={typeof value === "number" ? value : value == null ? "" : String(value)}
          min={schema.minimum}
          max={schema.maximum}
          onChange={(event) => {
            const text = event.target.value;
            if (text === "") return onChange(schema.default ?? null);
            const next = Number(text);
            onChange(hasType(schema, "integer") ? Math.round(next) : next);
          }}
        />
      </Wrap>
    );
  }

  if (hasType(schema, "string")) {
    const multiline = schema["x-widget"] === "textarea" || (schema.maxLength ?? 0) > 220;
    return (
      <Wrap {...common}>
        {multiline ? (
          <textarea
            className="ma-input ma-textarea"
            rows={3}
            value={value == null ? "" : String(value)}
            maxLength={schema.maxLength}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : (
          <input
            className="ma-input"
            type={schema.format === "date-time" ? "datetime-local" : "text"}
            dir={schema.format === "date-time" ? "ltr" : undefined}
            value={value == null ? "" : String(value)}
            maxLength={schema.maxLength}
            onChange={(event) => onChange(event.target.value)}
          />
        )}
      </Wrap>
    );
  }

  if (hasType(schema, "array")) {
    const items = resolve(schema.items, root);
    const list = asArray(value);
    const primitiveString = hasType(items, "string") || (!items.type && !items.$ref && !items.properties);
    if (primitiveString) {
      return (
        <Wrap {...common}>
          <textarea
            className="ma-input ma-textarea"
            rows={3}
            value={list.map((item) => String(item)).join("\n")}
            onChange={(event) =>
              onChange(
                event.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter(Boolean),
              )
            }
          />
          <span className="ma-help">{t("سطر لكل قيمة", "One value per line")}</span>
        </Wrap>
      );
    }
    return (
      <div className="ma-field" data-path={path}>
        <span className="ma-label">
          {title}
          <span className="ma-help" style={{ marginInlineStart: 6 }}>{list.length}</span>
        </span>
        {schema.description ? <span className="ma-help">{schema.description}</span> : null}
        {list.map((item, index) => (
          <div
            key={index}
            style={{
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-control)",
              padding: "var(--space-3)",
              marginBlockEnd: "var(--space-2)",
            }}
          >
            <div className="ma-cell-flex" style={{ justifyContent: "space-between", marginBlockEnd: "var(--space-2)" }}>
              <strong>{t(`عنصر ${index + 1}`, `Item ${index + 1}`)}</strong>
              <Button
                sm
                kind="ghost"
                label={t("إزالة", "Remove")}
                onClick={() => onChange(list.filter((_, candidate) => candidate !== index))}
              />
            </div>
            <SchemaNode
              schema={items}
              root={root}
              value={item}
              onChange={(next) => {
                const copy = [...list];
                copy[index] = next;
                onChange(copy);
              }}
              path={`${path}/${index}`}
              issues={issues}
              depth={depth + 1}
            />
          </div>
        ))}
        <Button
          sm
          kind="soft"
          icon="plus"
          label={t("إضافة عنصر", "Add item")}
          onClick={() => onChange([...list, defaultFor(items, root)])}
        />
      </div>
    );
  }

  if (hasType(schema, "object") || schema.properties) {
    const object = asRecord(value);
    const properties = schema.properties ?? {};
    const known = new Set(Object.keys(properties));
    const extra = Object.fromEntries(Object.entries(object).filter(([entry]) => !known.has(entry)));
    const open = schema.additionalProperties === true || typeof schema.additionalProperties === "object";
    const localized = schema["x-widget"] === "localized";
    if (!Object.keys(properties).length) return <RawJson value={value} onChange={onChange} />;
    return (
      <div className={localized ? "ma-form-grid ma-form-grid--2" : undefined} data-path={path}>
        {Object.entries(properties).map(([key, child]) => {
          const childSchema = resolve(child, root);
          return (
            <SchemaNode
              key={key}
              schema={child}
              root={root}
              value={object[key]}
              onChange={(next) => onChange({ ...object, [key]: next })}
              path={`${path}/${key}`}
              issues={issues}
              label={childSchema.title ?? humanizeKey(key)}
              required={(schema.required ?? []).includes(key)}
              depth={depth + 1}
            />
          );
        })}
        {open ? (
          <Wrap
            label={t("خصائص إضافية (JSON)", "Additional properties (JSON)")}
            description={t(
              "هذا المحرّك يقبل محتوى غير مقيّد بمخطط. أضف الحقول هنا أو استخدم تبويب JSON الخام.",
              "This engine accepts content not described by its schema. Add fields here, or use the raw JSON tab.",
            )}
            issues={issues}
            path={`${path}/*`}
          >
            <RawJson
              value={extra}
              onChange={(next) => {
                const merged = { ...object };
                for (const key of Object.keys(merged)) if (!known.has(key)) delete merged[key];
                Object.assign(merged, asRecord(next));
                onChange(merged);
              }}
            />
          </Wrap>
        ) : null}
      </div>
    );
  }

  return <RawJson value={value} onChange={onChange} />;
}

function defaultFor(schema: JsonSchema, root: JsonSchema): unknown {
  const resolved = resolve(schema, root);
  if (resolved.default !== undefined) return resolved.default;
  if (resolved.enum?.length) return resolved.enum[0];
  if (hasType(resolved, "object") || resolved.properties) {
    const entry: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(resolved.properties ?? {})) {
      const childSchema = resolve(child, root);
      if (hasType(childSchema, "string")) entry[key] = "";
      else if (hasType(childSchema, "array")) entry[key] = [];
      else if (hasType(childSchema, "number") || hasType(childSchema, "integer")) entry[key] = 0;
      else if (hasType(childSchema, "boolean")) entry[key] = false;
      else if (hasType(childSchema, "object") || childSchema.properties) entry[key] = defaultFor(childSchema, root);
    }
    return entry;
  }
  if (hasType(resolved, "array")) return [];
  if (hasType(resolved, "number") || hasType(resolved, "integer")) return 0;
  if (hasType(resolved, "boolean")) return false;
  return "";
}

/** Render a whole document. `path` is the JSON-pointer prefix the API uses in issue paths. */
export function SchemaForm({
  schema,
  value,
  onChange,
  issues = [],
  path = "",
}: {
  schema: JsonSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  issues?: SchemaIssue[];
  path?: string;
}) {
  return (
    <SchemaNode
      schema={schema}
      root={schema}
      value={value}
      onChange={onChange}
      path={path}
      issues={issues}
    />
  );
}

/** Group validation issues for display above a form, with a readable path. */
export function IssueList({ issues }: { issues: SchemaIssue[] }) {
  const t = useT();
  if (!issues.length) return null;
  return (
    <ul className="ma-list" style={{ margin: 0, paddingInlineStart: "1.2em" }}>
      {issues.map((issue, index) => (
        // Warnings inherit the text colour: alerts already carry the warning tone (yellow on yellow is unreadable).
        <li key={`${issue.path}-${index}`} style={{ color: issue.level === "error" ? "var(--danger)" : "inherit" }}>
          <bdi>{issue.path || "/"}</bdi> — {issue.message}
          {issue.level === "warning" ? <span className="ma-help"> ({t("تنبيه", "warning")})</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** A compact inline "jump to raw JSON" affordance used by the Studio tabs. */
export function RawHint({ children }: { children?: ReactNode }) {
  const t = useT();
  return (
    <p className="ma-help">
      <Icon name="info" /> {children ?? t("يمكن دائمًا تعديل المستند من تبويب JSON الخام.", "You can always edit the document from the raw JSON tab.")}
    </p>
  );
}

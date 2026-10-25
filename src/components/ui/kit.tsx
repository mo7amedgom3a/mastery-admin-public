import { useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { AppLink } from "./app-link";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./button";
import { useT } from "@/lib/i18n";
import { SelectField } from "./select";

// ---------------------------------------------------------------- badge / avatar / flag

export type BadgeDef = { label: { ar: string; en: string }; tone?: "success" | "warning" | "danger" | "info" | "neutral" };

export function Badge({ def }: { def?: BadgeDef | null }) {
  const t = useT();
  if (!def) return null;
  return <span className={cn("ma-badge", `ma-badge--${def.tone ?? "neutral"}`)}>{t(def.label.ar, def.label.en)}</span>;
}

/** Business label not yet confirmed: an inline warning, never colour alone. */
export function Unconfirmed() {
  const t = useT();
  const label = t("التسمية غير مؤكدة من الأعمال", "Label not yet confirmed by the business");
  return (
    <span className="ma-flag" title={label}>
      <Icon name="alert" />
      <span className="ma-sr">{t("غير مؤكد", "unconfirmed")}</span>
    </span>
  );
}

/**
 * Round avatar. Pass `src` to render a photo; it falls back to `initials` on a missing/broken URL,
 * so legacy rows with a `profileImage` never show a broken image. `square` gives a rounded-square
 * crop used for product thumbnails (courses, diplomas, packages, consultations).
 */
export function Avatar({ initials, src, color = "var(--yellow)", lg = false, square = false, alt }: { initials: string; src?: string | null; color?: string; lg?: boolean; square?: boolean; alt?: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <span className={cn("ma-avatar", lg && "ma-avatar--lg", square && "ma-avatar--square")} style={{ background: showImage ? undefined : color }} aria-hidden={showImage ? undefined : true}>
      {showImage ? <img src={src as string} alt={alt ?? ""} loading="lazy" decoding="async" onError={() => setFailed(true)} /> : initials}
    </span>
  );
}

// ---------------------------------------------------------------- button

type ButtonKind = "primary" | "ink" | "secondary" | "ghost" | "soft" | "bare" | "danger";
const BUTTON_VARIANT: Record<ButtonKind, ButtonVariant> = {
  primary: "primary",
  ink: "secondary",
  secondary: "secondary",
  ghost: "ghost",
  soft: "soft",
  bare: "bare",
  danger: "danger",
};

export type ButtonProps = {
  label?: ReactNode;
  kind?: ButtonKind;
  /** Line icon from the admin set. */
  icon?: string;
  /** Pre-built icon node (e.g. an animated icon from `@/components/icons/animated`). */
  iconNode?: ReactNode;
  /** Mirror the icon in RTL (directional chevrons/arrows). */
  iconDir?: boolean;
  /** Put the icon after the label (e.g. "Next ›"). */
  iconEnd?: boolean;
  href?: string;
  /** Link-only: e.g. `_blank` for a page on the storefront. */
  target?: string;
  rel?: string;
  size?: ButtonSize;
  sm?: boolean;
  block?: boolean;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
  "aria-label"?: string;
  "aria-busy"?: boolean;
};

export function Button({ label, kind = "soft", icon, iconNode, iconDir, iconEnd, href, target, rel, size, sm, block, children, type = "button", disabled, onClick, className, ...rest }: ButtonProps) {
  const cls = cn(buttonClass({ variant: BUTTON_VARIANT[kind], size: size ?? (sm ? "sm" : "md"), block }), className);
  const glyph = iconNode ?? (icon ? <Icon name={icon} className={iconDir ? "ma-icon-dir" : undefined} /> : null);
  const inner = children ?? (
    <>
      {iconEnd ? null : glyph}
      {label ? <span>{label}</span> : null}
      {iconEnd ? glyph : null}
    </>
  );
  if (href) {
    return (
      <AppLink className={cls} to={href} target={target} rel={rel} {...rest}>
        {inner}
      </AppLink>
    );
  }
  return (
    <button type={type} className={cls} disabled={disabled} onClick={onClick} {...rest}>
      {inner}
    </button>
  );
}

export function IconButton({
  icon,
  iconNode,
  label,
  onClick,
  className,
  dirIcon = false,
  ...rest
}: { icon?: string; iconNode?: ReactNode; label: string; onClick?: () => void; className?: string; dirIcon?: boolean } & Record<string, unknown>) {
  return (
    <button
      type="button"
      className={cn(buttonClass({ variant: "bare" }), "ma-btn--icon", className)}
      aria-label={label}
      title={label}
      onClick={onClick}
      {...rest}
    >
      {iconNode ?? (icon ? <Icon name={icon} className={dirIcon ? "ma-icon-dir" : undefined} /> : null)}
    </button>
  );
}

// ---------------------------------------------------------------- page head / tabs

export function PageHead({ title, status, sub, actions, back }: { title: ReactNode; status?: ReactNode; sub?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <header className="ma-page-head">
      <div className="ma-page-head__text">
        {back ? (
          <AppLink className="ma-back" to={back.href}>
            <Icon name="arrowBack" />
            {back.label}
          </AppLink>
        ) : null}
        <h1>
          {title} {status}
        </h1>
        {sub ? <p className="ma-page-head__sub">{sub}</p> : null}
      </div>
      {actions ? <div className="ma-page-head__actions">{actions}</div> : null}
    </header>
  );
}

export function PageTabs({ base, list, active }: { base: string; list: [string, string][]; active?: string }) {
  const t = useT();
  return (
    <nav className="ma-pagetabs" aria-label={t("أقسام الصفحة", "Page sections")}>
      {list.map(([slug, label]) => {
        const href = slug ? `${base}/${slug}` : base;
        return (
          <AppLink key={slug} to={href} aria-current={slug === active ? "page" : undefined}>
            {label}
          </AppLink>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------- kpi / card

export function Kpi({
  label,
  value,
  meta,
  delta,
  icon,
  field,
  bare = false,
}: {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  delta?: number;
  icon?: string;
  field?: string;
  /** No panel around the figure (for KPIs grouped inside another panel). */
  bare?: boolean;
}) {
  const d =
    delta == null ? null : (
      <span className={`ma-kpi__delta--${delta >= 0 ? "up" : "down"}`}>
        {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
      </span>
    );
  const inner = (
    <div className="ma-kpi">
      <span className="ma-kpi__label">
        {icon ? <Icon name={icon} /> : null}
        {label}
      </span>
      <span className="ma-kpi__value">{value}</span>
      {meta || d ? (
        <span className="ma-kpi__meta">
          {d}
          {meta}
        </span>
      ) : null}
    </div>
  );
  if (bare) return inner;
  return field ? (
    <div className="ma-fieldblock" style={{ background: field }}>
      {inner}
    </div>
  ) : (
    <div className="ma-panel">{inner}</div>
  );
}

export function Card({ title, actions, flush, children, id, className }: { title?: ReactNode; actions?: ReactNode; flush?: boolean; children: ReactNode; id?: string; className?: string }) {
  return (
    <section className={cn("ma-panel", flush && "ma-panel--flush", className)} id={id}>
      {title || actions ? (
        <div className="ma-panel__head">
          {title ? <h2 className="ma-panel__title">{title}</h2> : null}
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Dl({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="ma-dl">
      {rows.map(([k, v], index) => (
        <FragmentRow key={index} term={k} desc={v} />
      ))}
    </dl>
  );
}

function FragmentRow({ term, desc }: { term: ReactNode; desc: ReactNode }) {
  return (
    <>
      <dt>{term}</dt>
      <dd>{desc}</dd>
    </>
  );
}

// ---------------------------------------------------------------- empty / alert / bars

export function Empty({ text, icon = "inbox", action }: { text: ReactNode; icon?: string; action?: ReactNode }) {
  return (
    <div className="ma-empty">
      <Icon name={icon} />
      <p>{text}</p>
      {action}
    </div>
  );
}

/** Loading placeholder inside a panel or table body. */
export function Loading({ label }: { label?: ReactNode }) {
  const t = useT();
  return (
    <div className="ma-loading" role="status" aria-live="polite">
      {label ?? t("جارٍ التحميل…", "Loading…")}
    </div>
  );
}

/** A failed request or mutation as the kit danger alert: what failed + the server's message. */
export function ErrorAlert({ error, title }: { error: unknown; title?: ReactNode }) {
  const t = useT();
  if (!error) return null;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : t("حدث خطأ غير متوقع.", "Something went wrong.");
  return (
    <Alert kind="danger" title={title ?? t("تعذّر إكمال الطلب", "Couldn't complete the request")}>
      {message}
    </Alert>
  );
}

/** Form footer: the primary submit first, then a ghost cancel. */
export function FormActions({ children }: { children: ReactNode }) {
  return <div className="ma-form__actions">{children}</div>;
}

/** Inline "From [date] To [date]" range for toolbars and page heads (40px row). */
export function DateRange({
  from,
  to,
  onFrom,
  onTo,
  onClear,
}: {
  from: string;
  to: string;
  onFrom: (value: string) => void;
  onTo: (value: string) => void;
  onClear?: () => void;
}) {
  const t = useT();
  return (
    <div className="ma-range" role="group" aria-label={t("النطاق الزمني", "Date range")}>
      <label className="ma-range__field">
        {t("من", "From")}
        <input className="ma-input" type="date" value={from} max={to || undefined} onChange={(event) => onFrom(event.target.value)} />
      </label>
      <label className="ma-range__field">
        {t("إلى", "To")}
        <input className="ma-input" type="date" value={to} min={from || undefined} onChange={(event) => onTo(event.target.value)} />
      </label>
      {onClear && (from || to) ? <Button kind="ghost" sm icon="x" label={t("مسح", "Clear")} className="ma-range__clear" onClick={onClear} /> : null}
    </div>
  );
}

export function Alert({ kind, title, children, icon }: { kind: "success" | "warning" | "danger" | "info"; title: ReactNode; children?: ReactNode; icon?: string }) {
  const glyph = icon ?? (kind === "success" ? "check" : kind === "info" ? "info" : "alert");
  return (
    <div className={cn("ma-alert", `ma-alert--${kind}`)} role={kind === "danger" ? "alert" : "status"}>
      <Icon name={glyph} />
      <div>
        <p className="ma-alert__title">{title}</p>
        {children ? <div className="ma-alert__text">{children}</div> : null}
      </div>

    </div>
  );
}

export function Bars({ rows, max, fmt = (v: number) => String(v) }: { rows: { label: ReactNode; value: number; color?: string }[]; max?: number; fmt?: (v: number) => ReactNode }) {
  const m = max ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="ma-bars">
      {rows.map((r, index) => (
        <div className="ma-bar" key={index}>
          <span>{r.label}</span>
          <span className="ma-num">{fmt(r.value)}</span>
          <div className="ma-bar__track">
            <div className="ma-bar__fill" style={{ width: `${Math.max(2, (r.value / m) * 100)}%`, background: r.color ?? "var(--coral)" } as CSSProperties} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- field

export function Field({
  id,
  label,
  type = "text",
  value,
  hint,
  options,
  required,
  rows,
  onChange,
  name,
  ...rest
}: {
  id: string;
  label: ReactNode;
  type?: string;
  value?: string | number;
  hint?: ReactNode;
  options?: [string, string][];
  required?: boolean;
  rows?: number;
  onChange?: (value: string) => void;
  name?: string;
} & Record<string, unknown>) {
  const shared = { id, name: name ?? id, required, "aria-describedby": hint ? `${id}-hint` : undefined, ...rest };
  let control;
  if (options) {
    control = (
      <SelectField
        label={typeof label === "string" ? label : id}
        size="md"
        value={String(value ?? options[0]?.[0] ?? "")}
        onChange={(next) => onChange?.(next)}
        options={options.map(([v, l]) => ({ value: v, label: l }))}
      />
    );
  } else if (type === "textarea") {
    control = <textarea className="ma-input ma-textarea" rows={rows ?? 4} value={value} onChange={(event) => onChange?.(event.target.value)} {...shared} />;
  } else {
    control = <input className="ma-input" type={type} value={value} onChange={(event) => onChange?.(event.target.value)} {...shared} />;
  }
  return (
    <div className="ma-field">
      <label className="ma-label" htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true" className="ma-req"> *</span> : null}
      </label>
      {control}
      {hint ? (
        <span className="ma-help" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

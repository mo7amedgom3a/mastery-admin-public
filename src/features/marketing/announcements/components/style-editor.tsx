import { Plus, Trash2 } from "lucide-react";

import type { AnnouncementStyle } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Field } from "@/components/ui/kit";

import { contrast, cssBackground, PRESETS } from "../model";

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function ColorInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  // `<input type=color>` needs a full 6-digit value; the text field accepts what the marketer pastes.
  const swatch = HEX.test(value) && value.length === 7 ? value : "#000000";
  return (
    <div className="ma-ann-color">
      <label className="ma-label" htmlFor={id}>
        {label}
      </label>
      <div className="ma-ann-color__row">
        <input type="color" aria-label={label} value={swatch} onChange={(event) => onChange(event.target.value)} />
        <input
          id={id}
          className="ma-input"
          dir="ltr"
          maxLength={7}
          value={value}
          aria-invalid={!HEX.test(value)}
          onChange={(event) => onChange(event.target.value.trim())}
        />
      </div>
    </div>
  );
}

/** Background (solid / 2–3 stop gradient), colours and size, with presets and a contrast check. */
export function StyleEditor({ style, onChange }: { style: AnnouncementStyle; onChange: (style: AnnouncementStyle) => void }) {
  const t = useT();
  const set = (patch: Partial<AnnouncementStyle>) => onChange({ ...style, ...patch, preset: patch.preset ?? null });
  const setBg = (patch: Partial<AnnouncementStyle["bg"]>) => set({ bg: { ...style.bg, ...patch } });
  const colors = style.bg.colors;
  const lowContrast = colors.filter((c) => HEX.test(c) && contrast(style.text_color ?? "#ffffff", c) < 4.5);

  return (
    <div className="ma-form">
      <div className="ma-field">
        <span className="ma-label">{t("قوالب جاهزة", "Presets")}</span>
        <div className="ma-ann-presets">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              className="ma-ann-preset"
              aria-pressed={style.preset === p.key}
              onClick={() => onChange({ ...p.style, height: style.height })}
            >
              <span className="ma-ann-preset__sample" style={{ background: cssBackground(p.style), color: p.style.text_color }}>
                <span>
                  {t("خصم", "Sale")} <span style={{ color: p.style.accent_color }}>30%</span>
                </span>
              </span>
              <span>{t(p.label.ar, p.label.en)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ma-form-grid ma-form-grid--2">
        <Field
          id="ann-bg-type"
          label={t("نوع الخلفية", "Background")}
          options={[
            ["gradient", t("تدرّج لوني", "Gradient")],
            ["solid", t("لون واحد", "Solid colour")],
          ]}
          value={style.bg.type}
          onChange={(v) => {
            const type = v as AnnouncementStyle["bg"]["type"];
            setBg({ type, colors: type === "solid" ? [colors[0]] : colors.length >= 2 ? colors : [colors[0], "#7b2ff7"], animated: type === "gradient" && style.bg.animated });
          }}
        />
        <Field
          id="ann-height"
          label={t("ارتفاع الشريط", "Bar height")}
          options={[
            ["regular", t("عادي", "Regular")],
            ["compact", t("مضغوط", "Compact")],
          ]}
          value={style.height ?? "regular"}
          onChange={(v) => set({ height: v as AnnouncementStyle["height"] })}
        />
      </div>

      <div className="ma-field">
        <span className="ma-label">{style.bg.type === "gradient" ? t("ألوان التدرّج", "Gradient stops") : t("لون الخلفية", "Background colour")}</span>
        <div className="ma-ann-colors">
          {colors.map((color, index) => (
            <div key={index} className="ma-ann-color">
              <ColorInput
                id={`ann-bg-${index}`}
                label={t(`اللون ${index + 1}`, `Stop ${index + 1}`)}
                value={color}
                onChange={(v) => setBg({ colors: colors.map((c, i) => (i === index ? v : c)) })}
              />
              {style.bg.type === "gradient" && colors.length > 2 ? (
                <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" onClick={() => setBg({ colors: colors.filter((_, i) => i !== index) })}>
                  <Trash2 size={14} aria-hidden /> {t("إزالة", "Remove")}
                </button>
              ) : null}
            </div>
          ))}
          {style.bg.type === "gradient" && colors.length < 3 ? (
            <button type="button" className="ma-btn ma-btn--ghost ma-btn--sm" style={{ alignSelf: "end" }} onClick={() => setBg({ colors: [...colors, "#7b2ff7"] })}>
              <Plus size={14} aria-hidden /> {t("لون ثالث", "Add a stop")}
            </button>
          ) : null}
        </div>
      </div>

      {style.bg.type === "gradient" ? (
        <div className="ma-form-grid ma-form-grid--2">
          <div className="ma-field">
            <label className="ma-label" htmlFor="ann-angle">
              {t("زاوية التدرّج", "Gradient angle")} <span className="ma-num">{style.bg.angle ?? 90}°</span>
            </label>
            <input id="ann-angle" type="range" min={0} max={360} step={5} value={style.bg.angle ?? 90} onChange={(event) => setBg({ angle: Number(event.target.value) })} />
          </div>
          <label className="ma-check" htmlFor="ann-animated" style={{ alignSelf: "end" }}>
            <input id="ann-animated" type="checkbox" checked={Boolean(style.bg.animated)} onChange={(event) => setBg({ animated: event.target.checked })} />
            <span>
              {t("تدرّج متحرك", "Animated gradient")}
              <span className="ma-member__meta"> · {t("يتوقف لمن يفضّل تقليل الحركة", "stops for reduced-motion visitors")}</span>
            </span>
          </label>
        </div>
      ) : null}

      <div className="ma-ann-colors">
        <ColorInput id="ann-text" label={t("لون النص", "Text")} value={style.text_color ?? "#ffffff"} onChange={(v) => set({ text_color: v })} />
        <ColorInput id="ann-accent" label={t("لون الإبراز", "Highlight")} value={style.accent_color ?? "#ffe14d"} onChange={(v) => set({ accent_color: v })} />
        <ColorInput id="ann-badge" label={t("خلفية الشارة", "Badge background")} value={style.badge_bg ?? "#1a1033"} onChange={(v) => set({ badge_bg: v })} />
      </div>

      {lowContrast.length ? (
        <Alert kind="warning" title={t("تباين منخفض", "Low contrast")}>
          {t(
            `النص صعب القراءة على ${lowContrast.join("، ")}. اختر لون نص أفتح أو أغمق (المطلوب 4.5:1 على الأقل).`,
            `Text is hard to read on ${lowContrast.join(", ")}. Pick a lighter or darker text colour (aim for at least 4.5:1).`,
          )}
        </Alert>
      ) : null}
    </div>
  );
}

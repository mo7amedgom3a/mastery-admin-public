/*
 * Card elements of a live diploma's README: fenced containers `:::name [title]` … `:::` inside a `## section`,
 * drawn by the storefront `/live/{slug}` page with its own layouts. Same grammar as the storefront parser
 * (mastery-front `features/live-training/readme/parse-live-readme.ts`) and the backend converter
 * (`app/modules/catalog/domain/live_readme.py`):
 *
 * - `outcomes`, `certificates`, `features`, `faq`: `### title` items, each followed by its text;
 * - `levels`: `### title | EN LABEL` items, each followed by its text;
 * - `training`: `### group` items, each followed by `- point` lines;
 * - `checklist`: `- item` lines;  `method`: `- **label**: text` lines;
 * - `trainer`: a `> roles` line, `- credential` lines and paragraphs.
 *
 * The studio edits an element as rows of fields (`ElementRows`) and writes it back with `serializeElement`.
 */

export type LiveElementKind =
  | "outcomes"
  | "checklist"
  | "levels"
  | "training"
  | "method"
  | "trainer"
  | "certificates"
  | "features"
  | "faq";

export const LIVE_ELEMENT_KINDS: readonly LiveElementKind[] = [
  "levels",
  "training",
  "outcomes",
  "checklist",
  "method",
  "trainer",
  "certificates",
  "features",
  "faq",
];

/** One editable row: field key → value. List fields (`items`, `credentials`, `paragraphs`) hold one entry per line. */
export type ElementRow = Record<string, string>;

export type ElementField = { key: string; ar: string; en: string; multiline?: boolean; ltr?: boolean };

export type ElementSpec = {
  ar: string;
  en: string;
  hintAr: string;
  hintEn: string;
  /** Fields of one row. */
  fields: ElementField[];
  /** A single record (the trainer) rather than a list of rows. */
  single?: boolean;
  /** Section heading and lead inserted with a new element. */
  section: { title: string; lead: string };
  /** Rows of a newly inserted element. */
  sample: ElementRow[];
};

const titleText = (titleAr: string, titleEn: string, textAr = "النص", textEn = "Text"): ElementField[] => [
  { key: "title", ar: titleAr, en: titleEn },
  { key: "text", ar: textAr, en: textEn, multiline: true },
];

export const ELEMENT_SPECS: Record<LiveElementKind, ElementSpec> = {
  levels: {
    ar: "ثلاثة مستويات متسلسلة",
    en: "Sequential levels",
    hintAr: "بطاقات ملوّنة مرقّمة، لكل مستوى عنوان وشارة إنجليزية ونص.",
    hintEn: "Numbered coloured cards; each level has a title, an English badge and text.",
    fields: [
      { key: "title", ar: "العنوان", en: "Title" },
      { key: "label", ar: "الشارة (إنجليزي)", en: "Badge (English)", ltr: true },
      { key: "text", ar: "الوصف", en: "Description", multiline: true },
    ],
    section: { title: "ثلاثة مستويات متسلسلة", lead: "من الأساسيات إلى الأدوات المتقدمة، كل مستوى يبني على ما قبله." },
    sample: [
      { title: "المستوى الأول", label: "LEVEL 1", text: "وصف المستوى الأول." },
      { title: "المستوى الثاني", label: "LEVEL 2", text: "وصف المستوى الثاني." },
      { title: "المستوى الثالث", label: "LEVEL 3", text: "وصف المستوى الثالث." },
    ],
  },
  training: {
    ar: "تدريب وليس كلام",
    en: "Hands-on training",
    hintAr: "أعمدة مرقّمة، لكل مجموعة عنوان ونقاط (نقطة في كل سطر).",
    hintEn: "Numbered columns; each group has a title and points (one per line).",
    fields: [
      { key: "title", ar: "عنوان المجموعة", en: "Group title" },
      { key: "items", ar: "النقاط (نقطة في كل سطر)", en: "Points (one per line)", multiline: true },
    ],
    section: { title: "تدريب وليس كلام", lead: "تدريب وتطبيق عملي من أرض الواقع — لا نظريات." },
    sample: [
      { title: "الغرف التطبيقية", items: "نقطة أولى\nنقطة ثانية" },
      { title: "المحاكاة", items: "نقطة أولى\nنقطة ثانية" },
      { title: "الأدوات", items: "نقطة أولى\nنقطة ثانية" },
    ],
  },
  outcomes: {
    ar: "ماذا ستحقّق",
    en: "Outcomes",
    hintAr: "بطاقات مرقّمة: عنوان قصير ونص.",
    hintEn: "Numbered cards: a short title and text.",
    fields: titleText("العنوان", "Title"),
    section: { title: "ماذا ستحقّق بعد الدورة؟", lead: "" },
    sample: [{ title: "النتيجة الأولى", text: "وصف النتيجة." }],
  },
  checklist: {
    ar: "قائمة تحقق",
    en: "Checklist",
    hintAr: "عبارات بعلامة صح على عمودين.",
    hintEn: "Ticked statements on two columns.",
    fields: [{ key: "text", ar: "العبارة", en: "Statement" }],
    section: { title: "لمن هذه الدورة؟", lead: "هذه الدورة لك إذا كنت…" },
    sample: [{ text: "الفئة الأولى" }, { text: "الفئة الثانية" }],
  },
  method: {
    ar: "طريقة التدريب",
    en: "Training method",
    hintAr: "صفوف: تسمية ووصف.",
    hintEn: "Rows: a label and a description.",
    fields: [
      { key: "label", ar: "التسمية", en: "Label" },
      { key: "text", ar: "الوصف", en: "Description", multiline: true },
    ],
    section: { title: "طريقة التدريب", lead: "" },
    sample: [{ label: "ورش عمل", text: "وصف الطريقة." }],
  },
  trainer: {
    ar: "المدرب",
    en: "Trainer",
    hintAr: "بطاقة المدرب: الصورة والاسم من بيانات الدبلوم، وهنا الأدوار والاعتمادات والنبذة.",
    hintEn: "Trainer card: photo and name come from the diploma; here go roles, credentials and bio.",
    single: true,
    fields: [
      { key: "roles", ar: "الأدوار", en: "Roles" },
      { key: "credentials", ar: "الاعتمادات (واحد في كل سطر)", en: "Credentials (one per line)", multiline: true },
      { key: "paragraphs", ar: "النبذة (فقرة في كل سطر)", en: "Bio (one paragraph per line)", multiline: true },
    ],
    section: { title: "المدرب", lead: "" },
    sample: [{ roles: "خبير…", credentials: "مدرب معتمد", paragraphs: "نبذة عن المدرب." }],
  },
  certificates: {
    ar: "الشهادات",
    en: "Certificates",
    hintAr: "شريط بعرض الصفحة: شهادات بعنوان ونص.",
    hintEn: "Full-width band: certificates with a title and text.",
    fields: titleText("اسم الشهادة", "Certificate"),
    section: { title: "شهادات معتمدة", lead: "" },
    sample: [{ title: "شهادة معتمدة", text: "وصف الشهادة." }],
  },
  features: {
    ar: "المميزات",
    en: "Features",
    hintAr: "بطاقات صغيرة بجانب الشهادات (ضعها في قسم الشهادات نفسه).",
    hintEn: "Small cards beside the certificates (put it in the certificates section).",
    fields: titleText("الميزة", "Feature"),
    section: { title: "مميزات الدورة", lead: "" },
    sample: [{ title: "ميزة", text: "وصف الميزة." }],
  },
  faq: {
    ar: "أسئلة شائعة",
    en: "FAQ",
    hintAr: "أسئلة وأجوبة قابلة للطي.",
    hintEn: "Collapsible questions and answers.",
    fields: titleText("السؤال", "Question", "الجواب", "Answer"),
    section: { title: "أسئلة شائعة عن الدورة", lead: "" },
    sample: [{ title: "سؤال؟", text: "الجواب." }],
  },
};

/** A card element found in the README text, with its line range (`start` = opener, `end` = closer). */
export type FoundElement = {
  kind: LiveElementKind;
  /** Text after the kind on the opener line (e.g. the features' subheading). */
  title: string;
  rows: ElementRow[];
  start: number;
  end: number;
  /** Line index of the `## heading` the element sits under, or -1. */
  headingLine: number;
  sectionTitle: string;
};

const HEADING = /^##\s+(.+?)(\s*\{#[a-z0-9-]+\})?\s*$/;
const OPENER = /^:::([a-z]+)(?:\s+(.*))?$/;
const ITEM = /^###\s+(.+)$/;
const BULLET = /^[-*+]\s+(.+)$/;

const isKind = (name: string): name is LiveElementKind => (LIVE_ELEMENT_KINDS as readonly string[]).includes(name);
const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();
const bulletText = (line: string) => line.trim().match(BULLET)?.[1].trim() ?? line.trim();

function titledRows(lines: string[]): { title: string; text: string[] }[] {
  const rows: { title: string; text: string[] }[] = [];
  for (const line of lines) {
    const heading = line.match(ITEM);
    if (heading) rows.push({ title: heading[1].trim(), text: [] });
    else if (line.trim()) {
      if (rows.length === 0) rows.push({ title: "", text: [] });
      rows[rows.length - 1].text.push(line.trim());
    }
  }
  return rows;
}

/** An element's body lines as editable rows. */
export function parseRows(kind: LiveElementKind, lines: string[]): ElementRow[] {
  switch (kind) {
    case "levels":
      return titledRows(lines).map((row) => {
        const bar = row.title.lastIndexOf("|");
        return bar < 0
          ? { title: row.title, label: "", text: oneLine(row.text.join(" ")) }
          : { title: row.title.slice(0, bar).trim(), label: row.title.slice(bar + 1).trim(), text: oneLine(row.text.join(" ")) };
      });
    case "training":
      return titledRows(lines).map((row) => ({ title: row.title, items: row.text.map(bulletText).join("\n") }));
    case "checklist":
      return lines.filter((line) => line.trim()).map((line) => ({ text: bulletText(line) }));
    case "method":
      return lines
        .filter((line) => line.trim())
        .map((line) => {
          const text = bulletText(line);
          const bold = text.match(/^\*\*(.+?)\*\*\s*[:：]?\s*(.*)$/);
          if (bold) return { label: bold[1].trim(), text: bold[2].trim() };
          const colon = text.indexOf(":");
          return colon < 0 ? { label: text, text: "" } : { label: text.slice(0, colon).trim(), text: text.slice(colon + 1).trim() };
        });
    case "trainer": {
      const roles: string[] = [];
      const credentials: string[] = [];
      const paragraphs: string[] = [];
      for (const line of lines) {
        const value = line.trim();
        if (!value) continue;
        if (value.startsWith(">")) roles.push(value.replace(/^>\s*/, ""));
        else if (BULLET.test(value)) credentials.push(bulletText(value));
        else paragraphs.push(value);
      }
      return [{ roles: oneLine(roles.join(" ")), credentials: credentials.join("\n"), paragraphs: paragraphs.join("\n") }];
    }
    default:
      return titledRows(lines).map((row) => ({ title: row.title, text: oneLine(row.text.join(" ")) }));
  }
}

const listLines = (value: string | undefined) => (value ?? "").split("\n").map(oneLine).filter(Boolean);

/** The element's markdown (opener to closer), from its rows. Values are kept on one line so they can't break the structure. */
export function serializeElement(kind: LiveElementKind, title: string, rows: ElementRow[]): string {
  const body: string[] = [];
  for (const row of rows) {
    const v = (key: string) => oneLine(row[key] ?? "");
    switch (kind) {
      case "levels":
        if (!v("title")) break;
        body.push(v("label") ? `### ${v("title")} | ${v("label")}` : `### ${v("title")}`);
        if (v("text")) body.push(v("text"));
        break;
      case "training":
        if (!v("title")) break;
        body.push(`### ${v("title")}`, ...listLines(row.items).map((item) => `- ${item}`));
        break;
      case "checklist":
        if (v("text")) body.push(`- ${v("text")}`);
        break;
      case "method":
        if (v("label")) body.push(v("text") ? `- **${v("label")}**: ${v("text")}` : `- **${v("label")}**`);
        break;
      case "trainer":
        if (v("roles")) body.push(`> ${v("roles")}`);
        body.push(...listLines(row.credentials).map((item) => `- ${item}`), ...listLines(row.paragraphs));
        break;
      default:
        if (!v("title")) break;
        body.push(`### ${v("title")}`);
        if (v("text")) body.push(v("text"));
    }
  }
  return [`:::${kind} ${oneLine(title)}`.trimEnd(), ...body, ":::"].join("\n");
}

/** A new `## section` with its lead and a sample element, ready to insert. */
export function elementTemplate(kind: LiveElementKind): string {
  const spec = ELEMENT_SPECS[kind];
  const title = kind === "features" ? spec.ar : "";
  return [`## ${spec.section.title}`, spec.section.lead, serializeElement(kind, title, spec.sample)]
    .filter(Boolean)
    .join("\n\n");
}

/** Every card element in the README, in order, with where it sits. */
export function findElements(markdown: string): FoundElement[] {
  const lines = markdown.split("\n");
  const found: FoundElement[] = [];
  let headingLine = -1;
  let sectionTitle = "";
  let fenced = false;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim().startsWith("```")) fenced = !fenced;
    if (fenced) continue;
    const heading = line.match(HEADING);
    if (heading) {
      headingLine = index;
      sectionTitle = heading[1].trim();
      continue;
    }
    const opener = line.trim().match(OPENER);
    if (!opener || !isKind(opener[1])) continue;
    let end = index + 1;
    // Like the storefront: an unclosed element ends with its section.
    while (end < lines.length && lines[end].trim() !== ":::" && !HEADING.test(lines[end])) end += 1;
    const closed = end < lines.length && lines[end].trim() === ":::";
    found.push({
      kind: opener[1],
      title: (opener[2] ?? "").trim(),
      rows: parseRows(opener[1], lines.slice(index + 1, end)),
      start: index,
      end: closed ? end : end - 1,
      headingLine,
      sectionTitle,
    });
    index = closed ? end : end - 1;
  }
  return found;
}

/** The README with one element (and its section heading) replaced. */
export function replaceElement(markdown: string, element: FoundElement, sectionTitle: string, title: string, rows: ElementRow[]): string {
  const lines = markdown.split("\n");
  const block = serializeElement(element.kind, title, rows).split("\n");
  lines.splice(element.start, element.end - element.start + 1, ...block);
  if (element.headingLine >= 0 && oneLine(sectionTitle) && oneLine(sectionTitle) !== element.sectionTitle) {
    const anchor = lines[element.headingLine].match(HEADING)?.[2] ?? "";
    lines[element.headingLine] = `## ${oneLine(sectionTitle)}${anchor}`;
  }
  return lines.join("\n");
}

/** The README without one element (its section heading and prose stay). */
export function removeElement(markdown: string, element: FoundElement): string {
  const lines = markdown.split("\n");
  lines.splice(element.start, element.end - element.start + 1);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

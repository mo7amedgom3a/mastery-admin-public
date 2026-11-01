import { FileCode } from "lucide-react";

import { Alert } from "@/components/ui/kit";
import { useT } from "@/lib/i18n";

const TEMPLATE = `## المقدمة

نص تعريفي بالمقال.

## المحاور الرئيسية

- المحور الأول
- المحور الثاني

## الخلاصة

خلاصة سريعة لما سبق.
`;

/** The post's README source (Markdown): a plain mirror saved with the draft, used by the markdown importer. */
export function ReadmePanel({
  value,
  editable,
  onChange,
}: {
  value: string;
  editable: boolean;
  onChange: (markdown: string) => void;
}) {
  const t = useT();
  return (
    <div className="ma-blog-readme">
      <Alert kind="info" title={t("مصدر README", "README source")}>
        {t(
          "هذا نص README المحفوظ مع المسودة؛ يُحفظ تلقائياً مع بقية التغييرات. استخدم «استيراد README / Markdown» في المحرر لتحويله إلى كتل.",
          "This is the README saved with the draft; it autosaves with the rest of your changes. Use \"Import README / Markdown\" in the editor to turn it into blocks.",
        )}
      </Alert>
      <div className="ma-blog-readme__bar">
        <button type="button" className="ma-sblock__btn" disabled={!editable} onClick={() => onChange(TEMPLATE)}>
          <FileCode size={14} aria-hidden /> {t("إدراج نموذج", "Insert template")}
        </button>
        <span className="ma-blog-hint">{t("Markdown عادي: عناوين، قوائم، اقتباسات.", "Plain Markdown: headings, lists, quotes.")}</span>
      </div>
      <textarea
        className="ma-input ma-textarea ma-blog-readme__code"
        rows={22}
        value={value}
        disabled={!editable}
        placeholder={t("اكتب أو الصق نص README هنا…", "Write or paste the README here…")}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
      />
    </div>
  );
}

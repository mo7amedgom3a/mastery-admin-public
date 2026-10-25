import { REPORT_CURRENCIES, type FxInfo, type MoneyAmount, type ReportCurrency, type ReportSource } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { formatByCurrency } from "@/lib/sales";
import { useT } from "@/lib/i18n";
import { useReportCurrency } from "@/lib/report-currency";
import { SelectField } from "@/components/ui/select";

/** USD / AED / SAR switch for the converted sales figures, and which systems the sales cover. */
export function CurrencySelect() {
  const t = useT();
  const { currency, setCurrency, source, setSource } = useReportCurrency();
  return (
    <>
      <SelectField
        label={t("مصدر المبيعات", "Sales source")}
        value={source}
        onChange={(value) => setSource(value as ReportSource)}
        options={[
          { value: "all", label: t("الكل (B2C + القديم)", "All (B2C + legacy)") },
          { value: "b2c", label: t("المتجر (B2C)", "B2C only") },
          { value: "legacy", label: t("النظام القديم", "Legacy only") },
        ]}
        className="ma-select-trigger--auto"
      />
      <SelectField
        label={t("عملة التقارير", "Report currency")}
        value={currency}
        onChange={(value) => setCurrency(value as ReportCurrency)}
        options={REPORT_CURRENCIES.map((code) => ({ value: code, label: code }))}
        className="ma-select-trigger--auto"
      />
    </>
  );
}

const SOURCE: Record<string, { ar: string; en: string }> = {
  frankfurter: { ar: "Frankfurter (مباشر)", en: "Frankfurter (live)" },
  cache: { ar: "Frankfurter (محفوظ)", en: "Frankfurter (cached)" },
  fallback: { ar: "سعر احتياطي ثابت", en: "fallback peg" },
  identity: { ar: "بدون تحويل", en: "no conversion" },
};

/** One muted line: converted currency, rate date/source and the original amounts. */
export function FxNote({ fx, original }: { fx?: FxInfo; original?: MoneyAmount[] }) {
  const t = useT();
  if (!fx) return null;
  const source = SOURCE[fx.source] ?? { ar: fx.source, en: fx.source };
  return (
    <p className="ma-note">
      {t("المبالغ محوّلة إلى", "Converted to")} <strong>{fx.currency}</strong>
      {fx.rates_as_of ? <> · {t("أسعار صرف", "rates as of")} {formatDate(fx.rates_as_of)}</> : null} · {t(source.ar, source.en)}
      {original?.length ? <> · {t("المبالغ الأصلية:", "Original amounts:")} <bdi>{formatByCurrency(original)}</bdi></> : null}
    </p>
  );
}

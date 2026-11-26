import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { runLiveTest, searchIndexQueries, type LiveTestProduct, type LiveTestResult } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { Alert, Badge, Button, Card, Empty } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/toast";

type Expected = { product_id: string; title: string | null };

const TOP_K_OPTIONS = ["5", "10", "20", "50"] as const;

/** Type keywords, optionally pick the products that should come back, and see what the index answers. */
export function LiveTestCard() {
  const t = useT();
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState<(typeof TOP_K_OPTIONS)[number]>("10");
  const [expected, setExpected] = useState<Expected[]>([]);
  const [pickerText, setPickerText] = useState("");
  const picker = useQuery({
    ...searchIndexQueries.products({ q: pickerText.trim(), limit: 6 }),
    enabled: pickerText.trim().length >= 2,
  });
  const test = useMutation({
    mutationFn: () =>
      runLiveTest({ query: query.trim(), top_k: Number(topK), expected_product_ids: expected.map((item) => item.product_id) }),
    onError: (error) => toast.error(error instanceof Error ? error.message : t("تعذّر تشغيل الاختبار", "Couldn't run the test")),
  });

  const addExpected = (item: Expected) => {
    setExpected((current) =>
      current.some((entry) => entry.product_id === item.product_id) || current.length >= 10 ? current : [...current, item],
    );
    setPickerText("");
  };

  return (
    <Card title={t("اختبار مباشر للبحث", "Live search test")}>
      <p className="ma-cell-sub">
        {t(
          "اكتب كلمات بحث لترى أقرب أجزاء المحتوى في الفهرس (تشابه دلالي) وما يعرضه بحث المتجر فعلاً. أضف المنتجات المتوقعة لمعرفة هل ظهرت وبأي ترتيب.",
          "Type a search to see the nearest content chunks in the index (semantic similarity) and what the storefront search actually returns. Add the products you expect to check whether, and where, they appear.",
        )}
      </p>
      <form
        className="ma-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) test.mutate();
        }}
      >
        <input
          className="ma-input"
          aria-label={t("كلمات البحث", "Search keywords")}
          placeholder={t("مثال: تعلم بايثون من الصفر", "e.g. excel for beginners")}
          value={query}
          maxLength={200}
          onChange={(event) => setQuery(event.target.value)}
          data-testid="live-test-query"
          style={{ flex: "1 1 280px" }}
        />
        <SelectField
          label={t("عدد النتائج", "Results")}
          value={topK}
          onChange={setTopK}
          options={TOP_K_OPTIONS.map((value) => ({ value, label: value }))}
        />
        <Button type="submit" kind="primary" icon="search" label={test.isPending ? t("جارٍ الاختبار…", "Testing…") : t("اختبار", "Test")} disabled={!query.trim() || test.isPending} />
      </form>

      <div className="ma-field">
        <label className="ma-label" htmlFor="live-test-expected">{t("المنتجات المتوقعة (اختياري)", "Expected products (optional)")}</label>
        <input
          id="live-test-expected"
          className="ma-input"
          placeholder={t("ابحث باسم المنتج لإضافته…", "Search a product name to add it…")}
          value={pickerText}
          onChange={(event) => setPickerText(event.target.value)}
        />
        {pickerText.trim().length >= 2 && picker.data ? (
          <ul className="ma-list" data-testid="live-test-picker">
            {picker.data.items.length === 0 ? <li className="ma-cell-sub">{t("لا نتائج", "No matches")}</li> : null}
            {picker.data.items.map((item) => (
              <li key={item.product_id}>
                <Button sm kind="ghost" icon="plus" label={`${item.title ?? item.slug ?? item.product_id} · ${item.product_type ?? ""}`}
                  onClick={() => addExpected({ product_id: item.product_id, title: item.title })} />
              </li>
            ))}
          </ul>
        ) : null}
        {expected.length ? (
          <div className="ma-row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
            {expected.map((item) => (
              <Button key={item.product_id} sm kind="soft" icon="x" label={item.title ?? item.product_id}
                aria-label={t(`إزالة ${item.title ?? ""}`, `Remove ${item.title ?? ""}`)}
                onClick={() => setExpected((current) => current.filter((entry) => entry.product_id !== item.product_id))} />
            ))}
          </div>
        ) : null}
      </div>

      {test.data ? <LiveTestOutcome result={test.data} /> : null}
    </Card>
  );
}

function LiveTestOutcome({ result }: { result: LiveTestResult }) {
  const t = useT();
  return (
    <div data-testid="live-test-result">
      <p className="ma-cell-sub">
        {result.embed_ms != null
          ? t(
              `التضمين ${formatNumber(result.embed_ms)} ms · البحث في المتجهات ${formatNumber(result.vector_ms ?? 0)} ms · بحث المتجر ${formatNumber(result.search_ms)} ms`,
              `Embedding ${formatNumber(result.embed_ms)} ms · vector query ${formatNumber(result.vector_ms ?? 0)} ms · storefront search ${formatNumber(result.search_ms)} ms`,
            )
          : t(`بحث المتجر ${formatNumber(result.search_ms)} ms`, `Storefront search ${formatNumber(result.search_ms)} ms`)}
      </p>
      {result.semantic_error ? (
        <Alert kind="warning" title={t("البحث الدلالي غير متاح", "Semantic search unavailable")}>{result.semantic_error}</Alert>
      ) : null}
      {result.storefront.length && !result.storefront_semantic_used ? (
        <Alert kind="warning" title={t("بحث المتجر استخدم الكلمات فقط", "Storefront used keywords only")}>
          {t("لم يُستخدم البحث الدلالي في هذه النتيجة (تجاوز المهلة أو تعطّل).", "Semantic search didn't contribute to this answer (over its time budget or off).")}
        </Alert>
      ) : null}

      {result.expectations.length ? (
        <Table data-testid="live-test-expectations">
          <TableHeader>
            <TableRow>
              <TableHead>{t("المنتج المتوقع", "Expected product")}</TableHead>
              <TableHead>{t("ترتيبه دلالياً", "Semantic rank")}</TableHead>
              <TableHead>{t("ترتيبه في المتجر", "Storefront rank")}</TableHead>
              <TableHead>{t("النتيجة", "Result")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.expectations.map((item) => (
              <TableRow key={item.product_id}>
                <TableCell>{item.title ?? item.product_id}</TableCell>
                <TableCell className="ma-num">{item.semantic_rank ?? "—"}</TableCell>
                <TableCell className="ma-num">{item.search_rank ?? "—"}</TableCell>
                <TableCell>
                  <Badge def={item.matched
                    ? { label: { ar: "ظهر ✓", en: "Matched ✓" }, tone: "success" }
                    : { label: { ar: "لم يظهر ✗", en: "Not matched ✗" }, tone: "danger" }} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      <div className="ma-grid">
        <ProductList title={t("بحث المتجر (ما يراه الزائر)", "Storefront search (what visitors see)")} items={result.storefront} />
        <ProductList title={t("أقرب المنتجات دلالياً", "Nearest products (semantic)")} items={result.semantic_products} />
      </div>

      <h4>{t("أقرب أجزاء المحتوى", "Nearest content chunks")}</h4>
      {result.chunks.length === 0 ? (
        <Empty text={t("لا أجزاء مطابقة.", "No matching chunks.")} icon="search" />
      ) : (
        <Table data-testid="live-test-chunks">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>{t("التشابه", "Similarity")}</TableHead>
              <TableHead>{t("المنتج", "Product")}</TableHead>
              <TableHead>{t("المصدر", "Source")}</TableHead>
              <TableHead>{t("النص", "Text")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.chunks.map((chunk) => (
              <TableRow key={chunk.rank}>
                <TableCell className="ma-num">{chunk.rank}</TableCell>
                <TableCell className="ma-num">{chunk.similarity.toFixed(3)}</TableCell>
                <TableCell>
                  {chunk.title ?? "—"}
                  <span className="ma-cell-sub">{[chunk.product_type, chunk.status].filter(Boolean).join(" · ")}</span>
                </TableCell>
                <TableCell><span className="ma-cell-sub">{chunk.source ?? "—"}</span></TableCell>
                <TableCell><span className="ma-cell-sub">{chunk.excerpt ?? "—"}</span></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function ProductList({ title, items }: { title: string; items: LiveTestProduct[] }) {
  const t = useT();
  return (
    <div>
      <h4>{title}</h4>
      {items.length === 0 ? (
        <Empty text={t("لا نتائج.", "No results.")} icon="search" />
      ) : (
        <ol>
          {items.map((item) => (
            <li key={item.product_id}>
              {item.title ?? item.product_id}{" "}
              <span className="ma-cell-sub">
                {[item.product_type, item.sources.join(" + "), item.score.toFixed(item.score < 0.1 ? 4 : 3)].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

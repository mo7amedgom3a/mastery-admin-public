import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";

import { createEngineDef, labEngineKeys, labEngineQueries } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Button, Card, ErrorAlert, Field, FormActions, Loading, PageHead } from "@/components/ui/kit";
import { toast } from "@/components/ui/toast";

import { COLORS } from "../model";
import { ICONS, engineName, keyify } from "../engine-model";

/** Learning → Practice labs → Engines → New: pick a runtime (or an engine to copy) and name it. */
export function EngineNewPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const runtimes = useQuery(labEngineQueries.runtimes());
  const engines = useQuery(labEngineQueries.list());
  const [mode, setMode] = useState<"runtime" | "copy">(params.get("copy") ? "copy" : "runtime");
  const [runtimeKey, setRuntimeKey] = useState("dialogue");
  const [copyOf, setCopyOf] = useState(params.get("copy") ?? "");
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [descAr, setDescAr] = useState("");
  const [icon, setIcon] = useState<string>("message");
  const [color, setColor] = useState<string>("sky");

  const authorable = useMemo(() => (runtimes.data?.items ?? []).filter((item) => item.authorable), [runtimes.data]);
  const copyable = useMemo(() => (engines.data?.items ?? []).filter((item) => !item.is_system), [engines.data]);
  const runtime = authorable.find((item) => item.key === runtimeKey);

  const create = useMutation({
    mutationFn: () =>
      createEngineDef({
        key: keyify(key || nameEn || nameAr),
        runtime_key: mode === "runtime" ? runtimeKey : null,
        name: { ar: nameAr.trim(), en: nameEn.trim() || null },
        description: { ar: descAr.trim(), en: null },
        icon,
        color,
        duplicate_of: mode === "copy" ? copyOf : null,
      }),
    onSuccess: (engine) => {
      void queryClient.invalidateQueries({ queryKey: labEngineKeys.all });
      toast.success(t("أُنشئ المحرّك كمسودة", "Engine created as a draft"));
      navigate(`/learning/labs/engines/${engine.engine.engine_id}/edit`, { replace: true });
    },
  });

  if (runtimes.isLoading || engines.isLoading) return <Loading />;
  if (runtimes.error) return <ErrorAlert error={runtimes.error} />;

  const ready = nameAr.trim() && keyify(key || nameEn || nameAr).length > 1 && (mode === "runtime" ? Boolean(runtime) : Boolean(copyOf));

  return (
    <>
      <PageHead
        back={{ href: "/learning/labs/engines", label: t("المحرّكات", "Engines") }}
        title={t("محرّك جديد", "New engine")}
        sub={t(
          "ابدأ من آلية تشغيل (مثل الحوار) أو انسخ محرّكًا موجودًا (مثل نسخ «مبيعات» لبناء «تحصيل ديون»). تضبط السياق والشخصيات والتقييم بعد الإنشاء.",
          "Start from a runtime (such as dialogue) or copy an existing engine (e.g. copy “Sales” to build “Debt collection”). Context, personas and scoring are set after creation.",
        )}
      />

      <Card title={t("نقطة البداية", "Starting point")}>
        <div className="ma-cell-flex" style={{ gap: 6 }}>
          <Button kind={mode === "runtime" ? "primary" : "ghost"} label={t("من آلية تشغيل", "From a runtime")} onClick={() => setMode("runtime")} />
          <Button kind={mode === "copy" ? "primary" : "ghost"} label={t("نسخ محرّك", "Copy an engine")} disabled={!copyable.length} onClick={() => setMode("copy")} />
        </div>
        {mode === "runtime" ? (
          <>
            <Field
              id="engine-runtime"
              label={t("آلية التشغيل", "Runtime")}
              value={runtimeKey}
              options={authorable.map((item) => [item.key, item.label])}
              onChange={setRuntimeKey}
            />
            {runtime ? (
              <Alert kind="info" title={runtime.label}>
                {runtime.description}
              </Alert>
            ) : (
              <Alert kind="warning" title={t("لا آليات قابلة للتأليف", "No authorable runtime")}>
                {t("لم يُسجَّل على الخادم أي محرّك يقبل محرّكات المشرفين.", "The API has no runtime that accepts admin engines.")}
              </Alert>
            )}
          </>
        ) : (
          <Field
            id="engine-copy"
            label={t("المحرّك المنسوخ", "Engine to copy")}
            value={copyOf || "none"}
            options={[["none", "—"], ...copyable.map((item): [string, string] => [item.engine_id, `${engineName(item)} (${item.key})`])]}
            onChange={(value) => setCopyOf(value === "none" ? "" : value)}
          />
        )}
      </Card>

      <Card title={t("بطاقة المحرّك", "Engine card")}>
        <div className="ma-form-grid">
          <Field
            id="engine-name-ar"
            label={t("الاسم (عربي)", "Name (Arabic)")}
            value={nameAr}
            required
            onChange={setNameAr}
          />
          <Field
            id="engine-name-en"
            label={t("الاسم (إنجليزي)", "Name (English)")}
            value={nameEn}
            onChange={(value) => {
              setNameEn(value);
              if (!keyTouched) setKey(keyify(value));
            }}
          />
          <Field
            id="engine-key"
            label={t("المفتاح", "Key")}
            value={key}
            required
            dir="ltr"
            hint={t("أحرف لاتينية صغيرة وأرقام وشرطات؛ لا يتغير بعد النشر", "Lowercase letters, digits and dashes; fixed once published")}
            onChange={(value) => {
              setKeyTouched(true);
              setKey(keyify(value));
            }}
          />
          <Field id="engine-icon" label={t("الأيقونة", "Icon")} value={icon} options={ICONS.map((item) => [item, item])} onChange={setIcon} />
          <Field id="engine-color" label={t("اللون", "Colour")} value={color} options={COLORS.map((item) => [item, item])} onChange={setColor} />
        </div>
        <Field id="engine-desc" type="textarea" rows={2} label={t("الوصف", "Description")} value={descAr} onChange={setDescAr} />
        {create.error ? <ErrorAlert error={create.error} /> : null}
        <FormActions>
          <Button kind="primary" label={create.isPending ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء المسودة", "Create draft")} disabled={!ready || create.isPending} onClick={() => create.mutate()} />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={() => navigate("/learning/labs/engines")} />
        </FormActions>
      </Card>
    </>
  );
}

export default EngineNewPage;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Monitor, Smartphone } from "lucide-react";

import {
  expertProfilesKeys,
  expertProfilesQueries,
  expertStudioKeys,
  getExpertCurrentPage,
  getExpertPageDocument,
  publishExpertPage,
  putExpertReadme,
  saveExpertPageDraft,
  unpublishExpertPage,
  uploadExpertPageAsset,
  type ExpertPageDocument,
} from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { Alert, Button, ErrorAlert, Loading } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { toast } from "@/components/ui/toast";
import { StudioEditor } from "@/features/learning/studio/editor/studio-editor";
import { StudioContext, type StudioEditorContext, type StudioProgramOption } from "@/features/learning/studio/editor/studio-context";
import type { PreviewDevice } from "@/features/learning/studio/preview/use-preview-channel";

import { ExpertPreview } from "./expert-preview";
import { pageSeed } from "./page-seed";
import { expertPublicUrl } from "./urls";

const TEMPLATE = `## نبذة

نص تعريفي عن المدرّب وخبرته.

## الخبرات والشهادات

- الشهادة الأولى
- الشهادة الثانية
`;
const AUTOSAVE_MS = 1200;
type Mode = "builder" | "readme";
type SaveState = "saved" | "dirty" | "saving" | "error";

/**
 * Expert page Studio (`/learning/instructors/:key/studio`), beside the storefront page that re-renders on every
 * change:
 * - **Page builder**: the course Studio's block editor (headings, lists, images, tables, banner, callout, FAQ,
 *   gallery, and program cards from the expert's own items). A new page opens pre-filled with what the expert's
 *   page shows now, section by section (`pageSeed`). The draft autosaves; "Publish" makes it the page body.
 * - **README**: the markdown page used while no built page is published (opens on the legacy bio, converted).
 */
export default function ExpertStudioPage() {
  const t = useT();
  const { trainerId: key = "" } = useParams<{ trainerId: string }>();
  const [mode, setMode] = useState<Mode>("builder");
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [showPreview, setShowPreview] = useState(true);
  const profile = useQuery(expertProfilesQueries.detail(key));
  const page = useQuery({ queryKey: expertStudioKeys.pageDocument(key), queryFn: () => getExpertPageDocument(key) });
  const readme = useQuery(expertProfilesQueries.readme(key));
  const products = useQuery(expertProfilesQueries.products(key));
  // What the page shows now: pre-fills a page that was never built, and "reload from the current page".
  const current = useQuery({
    queryKey: [...expertStudioKeys.pageDocument(key), "current"],
    queryFn: () => getExpertCurrentPage(key),
    enabled: Boolean(page.data),
  });
  const seed = useMemo(() => (current.data ? pageSeed(current.data) : null), [current.data]);

  // What the preview shows: the blocks being built (builder) or the README being edited.
  const [blocks, setBlocks] = useState<unknown[] | null>(null);
  const [readmeText, setReadmeText] = useState<string | null>(null);

  const programs: StudioProgramOption[] = useMemo(
    () =>
      (products.data ?? [])
        .filter((row) => row.status === "published")
        .map((row) => ({ slug: row.slug, title: row.title || row.slug, product_type: row.product_type, image: row.image })),
    [products.data],
  );

  const name = profile.data?.name ?? key;
  const previewBlocks = mode === "builder" ? (blocks ?? page.data?.draft ?? page.data?.published ?? seed ?? []) : [];
  const previewReadme = readmeText ?? readme.data?.markdown ?? "";

  return (
    <>
      <header className="ma-studio-head">
        <Button kind="ghost" icon="chevronStart" iconDir href={`/learning/instructors/${encodeURIComponent(key)}`} label={t("المدرّب", "Expert")} sm />
        <div className="ma-studio-head__title">
          <h1>{t(`صفحة ${name}`, `${name}’s page`)}</h1>
          <div className="ma-studio-head__meta">
            <span className="ma-studio-head__pub">
              {page.data?.published_at
                ? t(`منشورة ${formatDateTime(page.data.published_at)}`, `Published ${formatDateTime(page.data.published_at)}`)
                : t("الصفحة غير منشورة — يظهر README", "Page not published — the README shows")}
              {page.data?.published_at && page.data.changed ? t(" · تعديلات غير منشورة", " · unpublished changes") : ""}
            </span>
          </div>
        </div>
        <div className="ma-studio-head__actions">
          <div className="ma-seg" role="group" aria-label={t("جهاز المعاينة", "Preview device")}>
            <button type="button" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")} title={t("سطح المكتب", "Desktop")}>
              <Monitor size={16} aria-hidden />
            </button>
            <button type="button" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")} title={t("الجوال", "Mobile")}>
              <Smartphone size={16} aria-hidden />
            </button>
          </div>
          <button type="button" className="ma-sblock__btn" aria-pressed={showPreview} onClick={() => setShowPreview((shown) => !shown)}>
            {showPreview ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            {showPreview ? t("إخفاء المعاينة", "Hide preview") : t("إظهار المعاينة", "Show preview")}
          </button>
          <Button kind="ghost" icon="link" label={t("الصفحة العامة", "Public page")} href={expertPublicUrl(key)} target="_blank" rel="noopener noreferrer" />
        </div>
      </header>

      <div className="ma-studio__tabs" role="tablist" style={{ display: "flex", gap: "var(--space-2)", marginBlockEnd: "var(--space-3)" }}>
        {([["builder", "منشئ الصفحة", "Page builder"], ["readme", "README", "README"]] as const).map(([id, ar, en]) => (
          <button key={id} type="button" role="tab" aria-selected={mode === id} className={cn("ma-pagetab", mode === id && "is-active")} onClick={() => setMode(id)}>
            {t(ar, en)}
          </button>
        ))}
      </div>

      {profile.data?.status === "inactive" ? (
        <Alert kind="warning" title={t("الملف موقوف", "This profile is inactive")}>
          {t("الصفحة مخفية عن الموقع؛ المعاينة هنا فقط.", "The page is hidden from the site; only this preview shows it.")}
        </Alert>
      ) : null}

      <div className={cn("ma-studio", "ma-studio--workspace", !showPreview && "is-no-preview")}>
        <section
          className="ma-studio__canvas"
          aria-label={t("محرر الصفحة", "Page editor")}
          style={{ overflowY: "auto", maxHeight: "calc(100vh - 220px)", padding: "var(--space-2) var(--space-3)", display: "grid", gap: "var(--space-3)", alignContent: "start" }}
        >
          {mode === "builder" ? (
            page.isLoading || products.isLoading || (page.data && !page.data.draft && !page.data.published && current.isLoading) ? (
              <Loading />
            ) : page.data ? (
              <PageBuilder expertKey={key} document={page.data} seed={seed} programs={programs} onChange={setBlocks} />
            ) : (
              <ErrorAlert error={page.error} title={t("تعذّر تحميل الصفحة", "Couldn't load the page")} />
            )
          ) : (
            <ReadmeEditor expertKey={key} onChange={setReadmeText} />
          )}
        </section>
        {showPreview ? (
          <section className="ma-studio__preview" aria-label={t("المعاينة", "Preview")}>
            <ExpertPreview expertKey={key} readme={previewReadme} blocks={previewBlocks} device={device} />
          </section>
        ) : null}
      </div>
    </>
  );
}

/** The block editor with its draft autosave and publish controls. */
function PageBuilder({
  expertKey,
  document,
  seed,
  programs,
  onChange,
}: {
  expertKey: string;
  document: ExpertPageDocument;
  /** The current page as blocks (null while unavailable). */
  seed: unknown[] | null;
  programs: StudioProgramOption[];
  onChange: (blocks: unknown[]) => void;
}) {
  const t = useT();
  const lang = useLang();
  const queryClient = useQueryClient();
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<unknown>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [confirmReload, setConfirmReload] = useState(false);
  // Bumped by "reload from the current page": rebuilds the editor on the seed.
  const [reloads, setReloads] = useState(0);
  const pending = useRef<unknown[] | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const pickResolve = useRef<((value: { url: string; alt_text: string } | null) => void) | null>(null);
  const fromSeed = reloads > 0 || (!document.draft && !document.published);
  // Read once per editor build (see `editorKey`): later saves update `document` without rebuilding the editor.
  const [initialBlocks] = useState<unknown[]>(() => (fromSeed ? seed ?? [] : document.draft ?? document.published ?? []));
  const [startBlocks, setStartBlocks] = useState<unknown[]>(initialBlocks);
  const settle = useCallback(
    (next: ExpertPageDocument) => {
      queryClient.setQueryData(expertStudioKeys.pageDocument(expertKey), next);
      queryClient.invalidateQueries({ queryKey: expertProfilesKeys.detail(expertKey) });
    },
    [expertKey, queryClient],
  );

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const blocks = pending.current;
    if (!blocks) return;
    pending.current = null;
    setState("saving");
    try {
      settle(await saveExpertPageDraft(expertKey, blocks));
      setError(null);
      setState(pending.current ? "dirty" : "saved");
    } catch (caught) {
      pending.current ??= blocks;
      setError(caught);
      setState("error");
      throw caught;
    }
  }, [expertKey, settle]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const edit = (blocks: unknown[]) => {
    onChange(blocks);
    pending.current = blocks;
    setState("dirty");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush().catch(() => undefined), AUTOSAVE_MS);
  };

  const publish = useMutation({
    mutationFn: async () => {
      // A pre-filled page nobody edited yet is published as it stands.
      if (!document.draft && !pending.current) pending.current = startBlocks;
      await flush();
      return publishExpertPage(expertKey);
    },
    onSuccess: (next) => {
      settle(next);
      toast.success(next.revalidated ? t("نُشرت الصفحة على الموقع", "Published on the site") : t("نُشرت؛ تظهر خلال دقائق", "Published; it shows within minutes"));
    },
  });
  const unpublish = useMutation({
    mutationFn: () => unpublishExpertPage(expertKey),
    onSuccess: (next) => {
      settle(next);
      setConfirmUnpublish(false);
      toast.success(t("أُلغي النشر؛ يظهر README", "Unpublished; the README shows"));
    },
  });

  const upload = async (file: File) => (await uploadExpertPageAsset(expertKey, file)).url;
  const context: StudioEditorContext = useMemo(
    () => ({
      productRef: `expert:${expertKey}`,
      instructors: [],
      programs,
      pickAsset: () =>
        new Promise((resolve) => {
          pickResolve.current = resolve;
          fileInput.current?.click();
        }),
    }),
    [expertKey, programs],
  );

  const saveLabel = { saved: t("محفوظ", "Saved"), dirty: t("تعديلات غير محفوظة", "Unsaved changes"), saving: t("جارٍ الحفظ…", "Saving…"), error: t("تعذّر الحفظ", "Couldn't save") }[state];

  return (
    <StudioContext.Provider value={context}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <span className={cn("ma-studio-save", `is-${state}`)} role="status">{saveLabel}</span>
        <span style={{ flex: 1 }} />
        {seed ? <Button kind="ghost" icon="refresh" label={t("إعادة التحميل من الصفحة الحالية", "Reload from the current page")} onClick={() => setConfirmReload(true)} /> : null}
        {document.published_at ? (
          <Button kind="ghost" label={t("إلغاء النشر", "Unpublish")} onClick={() => setConfirmUnpublish(true)} />
        ) : null}
        <Button
          kind="primary"
          icon="check"
          disabled={publish.isPending || startBlocks.length === 0 || (state === "saved" && !document.changed && Boolean(document.published_at))}
          label={publish.isPending ? t("جارٍ النشر…", "Publishing…") : t("نشر الصفحة", "Publish page")}
          onClick={() => publish.mutate()}
        />
      </div>
      <ErrorAlert error={error ?? publish.error ?? unpublish.error} title={t("تعذّر حفظ الصفحة", "Couldn't save the page")} />
      {!document.draft && !document.published ? (
        <Alert kind="info" title={t("محمّلة من صفحة المدرّب الحالية", "Loaded from the expert's current page")}>
          {t(
            "يبدأ المحرر بمحتوى الصفحة الحالية قسماً قسماً: النبذة، المجالات والمهارات، كيف يساعدك، وبطاقات البرامج. عدّل أو أضف (اكتب / لصورة أو جدول أو بانر أو أسئلة شائعة) ثم انشر لتصبح هذه الصفحة محتوى صفحة المدرّب.",
            "The editor starts from the current page, section by section: about, fields and skills, how they help, and program cards. Edit or add (type / for an image, table, banner or FAQ), then publish to make it the expert's page.",
          )}
        </Alert>
      ) : null}
      <StudioEditor
        productRef={`expert:${expertKey}`}
        editorKey={`expert-${expertKey}-${reloads}`}
        initialBlocks={startBlocks}
        dir={lang === "ar" ? "rtl" : "ltr"}
        onChange={edit}
        uploadFile={upload}
        page="expert"
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          const resolve = pickResolve.current;
          pickResolve.current = null;
          if (!file || !resolve) return resolve?.(null);
          try {
            resolve({ url: await upload(file), alt_text: "" });
          } catch (caught) {
            toast.error(t("تعذّر رفع الصورة", "Couldn't upload the image"), caught instanceof Error ? caught.message : undefined);
            resolve(null);
          }
        }}
      />
      <ConfirmModal
        open={confirmReload}
        onOpenChange={setConfirmReload}
        title={t("إعادة التحميل من الصفحة الحالية؟", "Reload from the current page?")}
        message={t("تُستبدل المسودة بمحتوى صفحة المدرّب الحالية. الصفحة المنشورة لا تتغير حتى تنشر.", "The draft is replaced by the expert's current page content. The published page doesn't change until you publish.")}
        confirmLabel={t("إعادة التحميل", "Reload")}
        tone="warning"
        onConfirm={() => {
          const next = seed ?? [];
          setStartBlocks(next);
          setReloads((count) => count + 1);
          setConfirmReload(false);
          edit(next);
        }}
      />
      <ConfirmModal
        open={confirmUnpublish}
        onOpenChange={setConfirmUnpublish}
        title={t("إلغاء نشر الصفحة؟", "Unpublish the page?")}
        message={t("سيعود الموقع إلى عرض README. تبقى المسودة لتعيد نشرها لاحقاً.", "The site goes back to the README. The draft is kept to publish again later.")}
        confirmLabel={t("إلغاء النشر", "Unpublish")}
        tone="warning"
        loading={unpublish.isPending}
        onConfirm={() => unpublish.mutate()}
      />
    </StudioContext.Provider>
  );
}

/** The markdown README, shown on the storefront while no built page is published. */
function ReadmeEditor({ expertKey, onChange }: { expertKey: string; onChange: (markdown: string) => void }) {
  const t = useT();
  const queryClient = useQueryClient();
  const readme = useQuery(expertProfilesQueries.readme(expertKey));
  const [text, setText] = useState<string | null>(null);
  const saved = readme.data?.markdown ?? "";
  const value = text ?? saved;
  const dirty = text !== null && text !== saved;
  const save = useMutation({
    mutationFn: () => putExpertReadme(expertKey, value),
    onSuccess: (result) => {
      queryClient.setQueryData(expertProfilesKeys.readme(expertKey), result);
      queryClient.invalidateQueries({ queryKey: expertProfilesKeys.detail(expertKey) });
      setText(null);
      toast.success(result.revalidated ? t("تم الحفظ وتحديث صفحة المدرّب", "Saved; the public page is updated") : t("تم الحفظ", "Saved"));
    },
  });
  const update = (next: string) => {
    setText(next);
    onChange(next);
  };

  if (readme.isLoading) return <Loading />;
  return (
    <>
      <ErrorAlert error={readme.error ?? save.error} title={t("تعذّر تحميل README أو حفظه", "Couldn't load or save the README")} />
      {readme.data?.source === "bio" ? (
        <Alert kind="info" title={t("محوَّل من النبذة القديمة", "Converted from the legacy bio")}>
          {t("لم يُحفظ README بعد: حوّلنا نبذة HTML القديمة إلى Markdown.", "No README is saved yet: the old HTML bio was converted to Markdown.")}
        </Alert>
      ) : null}
      <textarea
        value={value}
        dir="auto"
        rows={26}
        spellCheck={false}
        aria-label="README (Markdown)"
        placeholder={TEMPLATE}
        onChange={(event) => update(event.target.value)}
        style={{ width: "100%", fontFamily: "var(--font-mono, monospace)", fontSize: "13px", lineHeight: 1.7, padding: "var(--space-3)" }}
      />
      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <Button kind="primary" icon="check" disabled={!dirty || save.isPending} label={save.isPending ? t("جارٍ الحفظ…", "Saving…") : t("حفظ README", "Save README")} onClick={() => save.mutate()} />
        {!value ? <Button label={t("ابدأ بقالب", "Start from a template")} onClick={() => update(TEMPLATE)} /> : null}
        {dirty ? <Button kind="ghost" label={t("تجاهل التغييرات", "Discard changes")} onClick={() => update(saved)} /> : null}
        <span className="ma-studio__hint" style={{ margin: 0 }}>
          {t("Markdown فقط: ## عناوين، - قوائم، **غامق**، [رابط](https://…).", "Markdown only: ## headings, - lists, **bold**, [link](https://…).")}
        </span>
      </div>
    </>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { Eye, EyeOff, FileCode } from "lucide-react";

import { Alert, Badge, Button, Card, ErrorAlert, Loading } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import {
  blogKeys,
  blogQueries,
  getBlogPost,
  publishBlogPost,
  unpublishBlogPost,
  type BlogAsset,
  type BlogBlock,
  type BlogDocument,
  type BlogPostDetail,
  type BlogPostStatus,
  type BlogPublishResult,
} from "@/lib/api";
import { can } from "@/lib/permissions";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import type { BlogEditor as Editor, BlogPartialBlock } from "@/features/marketing/blog/editor/blog-schema";
import { BlogEditor } from "@/features/marketing/blog/editor/blog-editor";
import { BlogEditorContext } from "@/features/marketing/blog/editor/blog-context";
import { ReadmeImportDialog } from "@/features/marketing/blog/editor/readme-import-dialog";
import { useBlogDraftSaver, type SaveState } from "@/features/marketing/blog/hooks/use-blog-draft-saver";
import {
  documentOfPost,
  documentProblem,
  sanitizeParsedBlocks,
  toDocument,
} from "@/features/marketing/blog/model/document";
import { BlogPreviewFrame } from "@/features/marketing/blog/preview/blog-preview-frame";
import { BlogAssetLibrary, BlogAssetPickerDialog } from "@/features/marketing/blog/panels/assets-panel";
import { DetailsPanel, type BlogDetailsValue } from "@/features/marketing/blog/panels/details-panel";
import { HistoryPanel } from "@/features/marketing/blog/panels/history-panel";
import { ReadmePanel } from "@/features/marketing/blog/panels/readme-panel";
import "../blog.css";

const TABS = ["editor", "readme", "details", "assets", "history"] as const;
type Tab = (typeof TABS)[number];

const STATUS_LABEL: Record<BlogPostStatus, { ar: string; en: string; tone: "neutral" | "success" | "warning" }> = {
  draft: { ar: "مسودة", en: "Draft", tone: "warning" },
  published: { ar: "منشور", en: "Published", tone: "success" },
  archived: { ar: "مؤرشف", en: "Archived", tone: "neutral" },
};

const SAVE_LABEL: Record<SaveState, [string, string]> = {
  saved: ["جميع التغييرات محفوظة", "All changes saved"],
  dirty: ["تغييرات غير محفوظة", "Unsaved changes"],
  saving: ["جارٍ الحفظ…", "Saving…"],
  error: ["فشل الحفظ", "Save failed"],
  conflict: ["تعارض في التعديل", "Edit conflict"],
};

/** `/marketing/blog/:postId/studio`: one post's editor, preview and publishing workspace. */
export default function BlogStudioPage() {
  const t = useT();
  const postId = useParams().postId ?? "";
  const post = useQuery(blogQueries.post(postId));

  if (post.isLoading) return <Loading label={t("جارٍ فتح استوديو المقال…", "Opening the post studio…")} />;
  if (post.error || !post.data) return <ErrorAlert error={post.error} title={t("تعذّر فتح المقال", "Couldn't open the post")} />;
  return <StudioWorkspace key={postId} postId={postId} initial={post.data} />;
}

type DraftState = {
  document: BlogDocument;
  readme: string;
  slug: string;
  authorId: string | null;
  categoryIds: string[];
  seoTitle: string;
  seoDescription: string;
};

function draftOf(post: BlogPostDetail): DraftState {
  return {
    document: documentOfPost(post),
    readme: post.readme_source ?? "",
    slug: post.slug,
    authorId: post.author?.instructor_id ?? null,
    categoryIds: post.categories.map((category) => category.category_id),
    seoTitle: post.seo_title ?? "",
    seoDescription: post.seo_description ?? "",
  };
}

function StudioWorkspace({ postId, initial }: { postId: string; initial: BlogPostDetail }) {
  const t = useT();
  const queryClient = useQueryClient();
  const editable = can("marketing.write");
  const [searchParams, setSearchParams] = useSearchParams();

  const [draft, setDraft] = useState<DraftState>(() => draftOf(initial));
  const draftRef = useRef(draft);
  const [status, setStatus] = useState<BlogPostStatus>(initial.status);
  const [publishedRevision, setPublishedRevision] = useState(initial.published_revision);
  const [editorKey, setEditorKey] = useState(`v${initial.draft_revision ?? 1}`);
  const [showPreview, setShowPreview] = useState(true);
  const [publishOpen, setPublishOpen] = useState(false);
  const [unpublishOpen, setUnpublishOpen] = useState(false);
  const [readmeOpen, setReadmeOpen] = useState(false);
  const [published, setPublished] = useState<BlogPublishResult | null>(null);
  const [picker, setPicker] = useState<{ resolve: (asset: BlogAsset | null) => void } | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const onEditorReady = useCallback((next: Editor | null) => setEditor(next), []);

  const tabParam = searchParams.get("tab");
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "editor";
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    setSearchParams(params, { replace: true });
  };

  const saver = useBlogDraftSaver(postId, initial.draft_revision ?? 1, (post) => {
    setStatus(post.status);
    setPublishedRevision(post.published_revision);
    queryClient.setQueryData(blogQueries.post(postId).queryKey, post);
    // A cleared slug is sent as null and the backend keeps the old one: show what it kept.
    if (!draftRef.current.slug.trim() && post.slug) {
      const next = { ...draftRef.current, slug: post.slug };
      draftRef.current = next;
      setDraft(next);
    }
  });
  const { reset } = saver;
  useEffect(() => reset(initial.draft_revision ?? 1), [reset, initial.draft_revision]);

  const apply = useCallback(
    (patch: Partial<DraftState>) => {
      const next = { ...draftRef.current, ...patch };
      draftRef.current = next;
      setDraft(next);
      if (!editable) return;
      saver.schedule({
        document: next.document,
        readme_source: next.readme,
        category_ids: next.categoryIds,
        slug: next.slug || null,
        author_instructor_id: next.authorId,
        seo_title: next.seoTitle || null,
        seo_description: next.seoDescription || null,
      });
    },
    [editable, saver],
  );

  const applyDetails = useCallback(
    (patch: Partial<BlogDetailsValue>) => {
      const base = draftRef.current;
      const meta = { ...base.document.meta };
      if (patch.title !== undefined) meta.title = patch.title;
      if (patch.summary !== undefined) meta.summary = patch.summary;
      if (patch.cover !== undefined) meta.cover = patch.cover;
      if (patch.tags !== undefined) meta.tags = patch.tags;
      apply({
        document: { ...base.document, meta },
        slug: patch.slug ?? base.slug,
        authorId: patch.authorId !== undefined ? patch.authorId : base.authorId,
        categoryIds: patch.categoryIds ?? base.categoryIds,
        seoTitle: patch.seoTitle ?? base.seoTitle,
        seoDescription: patch.seoDescription ?? base.seoDescription,
      });
    },
    [apply],
  );

  const onBlocks = useCallback(
    (blocks: unknown[]) => {
      const base = draftRef.current;
      apply({ document: toDocument(base.document.meta, blocks) });
    },
    [apply],
  );

  const document = draft.document;
  const problem = useMemo(() => documentProblem(document), [document]);
  const blocks = document.blocks as BlogBlock[];
  const details: BlogDetailsValue = {
    title: document.meta.title,
    summary: document.meta.summary,
    slug: draft.slug,
    authorId: draft.authorId,
    categoryIds: draft.categoryIds,
    tags: document.meta.tags,
    cover: document.meta.cover,
    seoTitle: draft.seoTitle,
    seoDescription: draft.seoDescription,
  };

  const previewBase = useQuery(blogQueries.previewBase(postId));
  const subscribers = useQuery(
    blogQueries.subscribers({ status: "active", page: 1, page_size: 1 }),
  );
  const subscriberTotal = subscribers.data?.total ?? 0;

  const publish = useMutation({
    mutationFn: async ({ note, notify }: { note: string; notify: boolean }) => {
      if (problem) throw new Error(problem);
      await saver.flush();
      return publishBlogPost(postId, {
        base_revision: saver.revision.current,
        note: note.trim() || null,
        notify_subscribers: notify,
      });
    },
    onSuccess: (result) => {
      setPublished(result);
      setPublishOpen(false);
      setStatus(result.post.status);
      setPublishedRevision(result.post.published_revision);
      queryClient.setQueryData(blogQueries.post(postId).queryKey, result.post);
      queryClient.invalidateQueries({ queryKey: blogKeys.versions(postId) });
      queryClient.invalidateQueries({ queryKey: blogKeys.notificationStats(postId) });
    },
  });

  const unpublish = useMutation({
    mutationFn: () => unpublishBlogPost(postId),
    onSuccess: (post) => {
      setUnpublishOpen(false);
      setStatus(post.status);
      queryClient.setQueryData(blogQueries.post(postId).queryKey, post);
    },
  });

  const load = (post: BlogPostDetail) => {
    const next = draftOf(post);
    draftRef.current = next;
    setDraft(next);
    setStatus(post.status);
    setPublishedRevision(post.published_revision);
    setEditorKey(`v${post.draft_revision ?? 1}-${Date.now()}`);
    saver.reset(post.draft_revision ?? 1);
    queryClient.setQueryData(blogQueries.post(postId).queryKey, post);
  };

  const reload = useMutation({
    mutationFn: () => getBlogPost(postId),
    onSuccess: (post) => load(post),
  });

  const pickAsset = useCallback(
    () => new Promise<BlogAsset | null>((resolve) => setPicker({ resolve })),
    [],
  );

  const editorContext = useMemo(
    () => ({
      postId,
      pickAsset: async (kind?: "image" | "video") => {
        void kind;
        const asset = await pickAsset();
        return asset ? { url: asset.url, alt_text: asset.alt_text } : null;
      },
    }),
    [postId, pickAsset],
  );

  const applyImport = (imported: BlogPartialBlock[], mode: "replace" | "append") => {
    if (!editor) return;
    const clean = sanitizeParsedBlocks(imported);
    if (mode === "replace" || editor.document.length === 0) {
      editor.replaceBlocks(editor.document, clean);
    } else {
      const last = editor.document[editor.document.length - 1];
      editor.insertBlocks(clean, last, "after");
    }
    onBlocks(editor.document as unknown[]);
  };

  const updateMetaFromImport = (meta: { title?: string; summary?: string }) => {
    applyDetails({ ...(meta.title ? { title: meta.title } : {}), ...(meta.summary ? { summary: meta.summary } : {}) });
  };

  // ⌘/Ctrl S saves now; ⌘/Ctrl ⇧ P opens publish.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        void saver.flush().catch(() => {});
      } else if (key === "p" && event.shiftKey && editable) {
        event.preventDefault();
        setPublishOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saver, editable]);

  const [saveAr, saveEn] = SAVE_LABEL[saver.state];
  const blockCount = blocks.length;

  const editorPane = (
    <section className="ma-studio__canvas" aria-label={t("محرر المقال", "Post editor")}>
      <div className="ma-blog-editor__bar">
        <p className="ma-studio__hint" style={{ margin: 0 }}>
          {t(
            "اكتب / لإضافة عنوان أو قائمة أو صورة أو أحد بلوكات المدونة… واسحب المقبض لإعادة الترتيب.",
            "Type / to add a heading, list, image or a blog block… drag the handle to reorder.",
          )}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="ma-blog-hint">{t(`${blockCount} كتلة`, `${blockCount} blocks`)}</span>
          <button
            type="button"
            className="ma-sblock__btn"
            disabled={!editable}
            onClick={() => setReadmeOpen(true)}
          >
            <FileCode size={14} aria-hidden />
            {t("استيراد README / Markdown", "Import README / Markdown")}
          </button>
        </div>
      </div>
      <BlogEditor
        postId={postId}
        editorKey={editorKey}
        initialBlocks={blocks}
        dir="rtl"
        onChange={onBlocks}
        onReady={onEditorReady}
        onOpenReadmeModal={() => setReadmeOpen(true)}
      />
    </section>
  );

  const previewPane = (
    <section className="ma-studio__preview" aria-label={t("المعاينة", "Preview")}>
      {previewBase.isError ? (
        <ErrorAlert error={previewBase.error} title={t("تعذّر تحميل بيانات المعاينة", "Couldn't load preview data")} />
      ) : null}
      <BlogPreviewFrame slug={draft.slug} base={previewBase.data?.base ?? null} document={document} />
    </section>
  );

  return (
    <BlogEditorContext.Provider value={editorContext}>
      <header className="ma-studio-head">
        <Button kind="ghost" icon="chevronStart" iconDir href="/marketing/blog" label={t("المدونة", "Blog")} sm />
        <div className="ma-studio-head__title">
          <h1>{document.meta.title || initial.title || t("مقال بدون عنوان", "Untitled post")}</h1>
          <div className="ma-studio-head__meta">
            <Badge def={{ label: { ar: STATUS_LABEL[status].ar, en: STATUS_LABEL[status].en }, tone: STATUS_LABEL[status].tone }} />
            <span className={cn("ma-studio-save", `is-${saver.state}`)} role="status">
              {t(saveAr, saveEn)}
            </span>
            <span className="ma-studio-head__pub">
              {publishedRevision
                ? t(`نُشر من المسودة ${publishedRevision}`, `Published from draft ${publishedRevision}`)
                : t("لم يُنشر بعد", "Not published yet")}
            </span>
          </div>
        </div>
        <div className="ma-studio-head__actions">
          <button
            type="button"
            className="ma-sblock__btn"
            aria-pressed={showPreview}
            onClick={() => setShowPreview((value) => !value)}
          >
            {showPreview ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
            {showPreview ? t("إخفاء المعاينة", "Hide preview") : t("إظهار المعاينة", "Show preview")}
          </button>
          {editable && status === "published" ? (
            <Button kind="secondary" label={t("إلغاء النشر", "Unpublish")} disabled={unpublish.isPending} onClick={() => setUnpublishOpen(true)} />
          ) : null}
          <Button
            kind="primary"
            icon="check"
            label={t("نشر", "Publish")}
            disabled={!editable || publish.isPending || saver.state === "conflict" || Boolean(problem) || blocks.length === 0}
            onClick={() => setPublishOpen(true)}
          />
        </div>
      </header>

      {!editable ? (
        <Alert kind="info" title={t("وضع القراءة فقط", "Read-only")}>
          {t("تحتاج صلاحية admin:marketing:write لتعديل المقال.", "You need admin:marketing:write to edit this post.")}
        </Alert>
      ) : null}
      {saver.state === "conflict" ? (
        <Alert kind="warning" title={t("عُدّلت المسودة في مكان آخر", "The draft was changed elsewhere")}>
          {t("حمّل أحدث نسخة (تُفقد تعديلاتك هنا) أو احفظ نسختك فوقها.", "Load the latest draft (your edits here are lost) or save yours over it.")}
          <div className="ma-studio-actions">
            <Button sm label={t("تحميل الأحدث", "Load latest")} disabled={reload.isPending} onClick={() => reload.mutate()} />
            <Button sm kind="secondary" label={t("حفظ نسختي", "Keep mine")} disabled={reload.isPending} onClick={() => void saver.overwrite().catch(() => {})} />
          </div>
        </Alert>
      ) : null}
      {saver.state === "error" ? <ErrorAlert error={saver.error} title={t("تعذّر حفظ المسودة", "Couldn't save the draft")} /> : null}
      {problem && saver.state !== "saved" ? (
        <Alert kind="warning" title={t("المقال يحتاج تصحيحاً قبل الحفظ", "The post needs a fix before it can be saved")}>{problem}</Alert>
      ) : null}
      {publish.error ? <ErrorAlert error={publish.error} title={t("تعذّر النشر", "Couldn't publish")} /> : null}
      {published ? (
        <Alert kind="success" title={t(`تم النشر — تم إرسال ${published.notifications_sent} بريد`, `Published — ${published.notifications_sent} emails sent`)}>
          {t(
            `النسخة ${published.version_number}. من ${published.notifications_queued} رسالة في قائمة الإشعارات.`,
            `Version ${published.version_number}. Of ${published.notifications_queued} queued notification emails.`,
          )}
          {published.revalidated ? ` ${t("وحُدّثت صفحات المدونة على الموقع.", "The storefront blog pages were refreshed.")}` : ""}
        </Alert>
      ) : null}

      <div className="ma-pagetabs" role="tablist" aria-label={t("أقسام الاستوديو", "Studio tabs")} style={{ marginBlock: "var(--space-3)" }}>
        {(
          [
            ["editor", "المحرر", "Editor"],
            ["readme", "README", "README"],
            ["details", "التفاصيل", "Details"],
            ["assets", "الوسائط", "Assets"],
            ["history", "السجل", "History"],
          ] as [Tab, string, string][]
        ).map(([id, ar, en]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {t(ar, en)}
          </button>
        ))}
      </div>

      {tab === "editor" ? (
        <div className={cn("ma-studio", "ma-studio--workspace", !showPreview && "is-no-preview")}>
          {editorPane}
          {showPreview ? previewPane : null}
        </div>
      ) : null}

      {tab === "readme" ? (
        <div className={cn("ma-studio", "ma-studio--workspace", !showPreview && "is-no-preview")}>
          <section className="ma-studio__canvas" style={{ overflowY: "auto", maxHeight: "calc(100vh - 170px)", padding: "var(--space-2) var(--space-3)" }}>
            <Card title={t("README المقال (Markdown)", "Post README (Markdown)")}>
              <ReadmePanel value={draft.readme} editable={editable} onChange={(readme) => apply({ readme })} />
            </Card>
          </section>
          {showPreview ? previewPane : null}
        </div>
      ) : null}

      {tab === "details" ? (
        <div className={cn("ma-studio", "ma-studio--workspace", !showPreview && "is-no-preview")}>
          <section className="ma-studio__canvas" style={{ overflowY: "auto", maxHeight: "calc(100vh - 170px)", padding: "var(--space-2) var(--space-3)" }}>
            <Card title={t("تفاصيل المقال", "Post details")}>
              <DetailsPanel value={details} editable={editable} onChange={applyDetails} pickAsset={pickAsset} />
            </Card>
          </section>
          {showPreview ? previewPane : null}
        </div>
      ) : null}

      {tab === "assets" ? (
        <div style={{ marginTop: "var(--space-3)", width: "100%" }}>
          <Card title={t("وسائط المقال", "Post assets")}>
            <BlogAssetLibrary postId={postId} editable={editable} />
          </Card>
        </div>
      ) : null}

      {tab === "history" ? (
        <div style={{ marginTop: "var(--space-3)", width: "100%" }}>
          <Card title={t("سجل النسخ المنشورة", "Version history")}>
            <HistoryPanel postId={postId} editable={editable} onRestored={load} />
          </Card>
        </div>
      ) : null}

      {picker ? (
        <BlogAssetPickerDialog
          postId={postId}
          kind="image"
          onClose={(asset) => {
            picker.resolve(asset);
            setPicker(null);
          }}
        />
      ) : null}

      {readmeOpen ? (
        <ReadmeImportDialog
          isOpen={readmeOpen}
          onClose={() => setReadmeOpen(false)}
          editor={editor}
          initialMarkdown={draft.readme}
          onApplyBlocks={applyImport}
          onUpdateMeta={updateMetaFromImport}
        />
      ) : null}

      {publishOpen ? (
        <BlogPublishDialog
          pending={publish.isPending}
          error={publish.error}
          subscriberTotal={subscriberTotal}
          onCancel={() => setPublishOpen(false)}
          onPublish={({ note, notify }) => publish.mutate({ note, notify })}
        />
      ) : null}

      <ConfirmModal
        open={unpublishOpen}
        onOpenChange={setUnpublishOpen}
        tone="warning"
        title={t("إلغاء نشر المقال", "Unpublish the post")}
        message={t(
          "سيصبح المقال مؤرشفاً ويختفي من الموقع. يمكنك نشره مرة أخرى لاحقاً.",
          "The post becomes archived and leaves the storefront. You can publish it again later.",
        )}
        confirmLabel={t("إلغاء النشر", "Unpublish")}
        loading={unpublish.isPending}
        onConfirm={() => unpublish.mutate()}
      />
    </BlogEditorContext.Provider>
  );
}

function BlogPublishDialog({
  pending,
  error,
  subscriberTotal,
  onCancel,
  onPublish,
}: {
  pending: boolean;
  error: unknown;
  subscriberTotal: number;
  onCancel: () => void;
  onPublish: (options: { note: string; notify: boolean }) => void;
}) {
  const t = useT();
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(true);
  return (
    <div className="ma-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <div
        className="ma-studio-dialog ma-studio-dialog--sm"
        role="dialog"
        aria-modal="true"
        aria-label={t("نشر المقال", "Publish the post")}
        onKeyDown={(event) => event.key === "Escape" && onCancel()}
      >
        <div className="ma-studio-dialog__head">
          <strong>{t("نشر المقال", "Publish the post")}</strong>
        </div>
        <p className="ma-studio-dialog__text">
          {t(
            "ستظهر المسودة الحالية للزوار على صفحة المقال، وتُحفظ نسخة جديدة في السجل.",
            "The current draft goes live on the post page and a new version is saved in the history.",
          )}
        </p>
        <label className="ma-label" htmlFor="blog-publish-note">{t("ملاحظة الإصدار (اختياري)", "Version note (optional)")}</label>
        <textarea id="blog-publish-note" className="ma-input ma-textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} autoFocus />
        <label className="ma-check">
          <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} />
          <span>
            {t(
              `إرسال إشعار بالبريد إلى ${subscriberTotal} مشترك`,
              `Email the ${subscriberTotal} active subscribers`,
            )}
          </span>
        </label>
        <p className="ma-blog-hint">
          {subscriberTotal > 0
            ? t("تُرسل الرسائل على دفعات من قائمة الإشعارات.", "Emails go out in batches from the notification queue.")
            : t("لا يوجد مشتركون نشطون حالياً.", "There are no active subscribers yet.")}
        </p>
        <ErrorAlert error={error} title={t("تعذّر النشر", "Couldn't publish")} />
        <div className="ma-studio-actions">
          <Button
            kind="primary"
            label={pending ? t("جارٍ النشر…", "Publishing…") : t("نشر", "Publish")}
            disabled={pending}
            onClick={() => onPublish({ note, notify })}
          />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onCancel} />
        </div>
      </div>
    </div>
  );
}

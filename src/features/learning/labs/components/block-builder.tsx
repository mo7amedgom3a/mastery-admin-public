import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getBlockDocument,
  labsKeys,
  labsQueries,
  validateBlockDocument,
  type BlockCatalog,
  type BlockDocument,
  type BlockNode,
  type BlockPage,
  type BlockTypeDef,
  type LabDetail,
  type LabScenario,
} from "@/lib/api";
import { useT } from "@/lib/i18n";
import { Alert, Badge, Button, Card, Empty, ErrorAlert, Field, Loading } from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { StorefrontViewport } from "@/features/learning/studio/preview/storefront-frame";
import { usePreviewChannel, type PreviewDevice } from "@/features/learning/studio/preview/use-preview-channel";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

import { IssueList, SchemaForm, type JsonSchema, type SchemaIssue } from "../schema-form";
import { useDocumentEditor, type DocumentEditor, type SaveState } from "../use-document-editor";
import { HistoryPanel } from "./history-panel";
import { ScenarioFlowPanel } from "../graph/scenario-flow-panel";

type Props = {
  labId: string;
  labSlug: string;
  scenarios: LabScenario[];
  canWrite: boolean;
};

const CATEGORY_LABEL: Record<string, { ar: string; en: string }> = {
  layout: { ar: "التخطيط", en: "Layout" },
  content: { ar: "المحتوى", en: "Content" },
  task: { ar: "المهام والمدخلات", en: "Tasks & inputs" },
  media: { ar: "الوسائط", en: "Media" },
  assessment: { ar: "التقييم", en: "Assessment" },
  advanced: { ar: "متقدم", en: "Advanced" },
};

/** Notion-style editor for a `blocks` scenario document: edits are local, autosaved and undoable. */
export function BlockBuilder({ labId, labSlug, scenarios, canWrite }: Props) {
  const [scenarioKey, setScenarioKey] = useState(scenarios[0]?.key ?? "main");
  const documentQuery = useQuery({ ...labsQueries.document(labId, scenarioKey), refetchOnWindowFocus: false });
  const catalogQuery = useQuery(labsQueries.blockTypes());
  const labQuery = useQuery(labsQueries.detail(labId));

  if (documentQuery.error) return <ErrorAlert error={documentQuery.error} />;
  if (catalogQuery.error) return <ErrorAlert error={catalogQuery.error} />;
  if (documentQuery.isLoading || !documentQuery.data || catalogQuery.isLoading || !catalogQuery.data) return <Loading />;

  return (
    <BuilderBody
      // A fresh editor per scenario; refetches of the same scenario never reset local edits.
      key={`${labId}:${scenarioKey}`}
      labId={labId}
      labSlug={labSlug}
      scenarios={scenarios}
      scenarioKey={scenarioKey}
      onScenario={setScenarioKey}
      document={documentQuery.data}
      catalog={catalogQuery.data}
      lab={labQuery.data}
      canWrite={canWrite}
    />
  );
}

function SaveIndicator({ editor }: { editor: DocumentEditor }) {
  const labels: Record<SaveState, [string, string, "success" | "warning" | "danger" | "info" | "neutral"]> = {
    saved: ["محفوظ", "Saved", "success"],
    dirty: ["تعديلات غير محفوظة", "Unsaved changes", "neutral"],
    saving: ["جارٍ الحفظ…", "Saving…", "info"],
    conflict: ["تعارض", "Conflict", "danger"],
    error: ["تعذّر الحفظ", "Save failed", "danger"],
  };
  const [ar, en, tone] = labels[editor.saveState];
  return (
    <span className="ma-cell-flex" style={{ gap: 6 }} aria-live="polite">
      <Badge def={{ label: { ar, en }, tone }} />
      {editor.savedAt && editor.saveState === "saved" ? (
        <span className="ma-help">{editor.savedAt.toLocaleTimeString()}</span>
      ) : null}
    </span>
  );
}

function BuilderBody({
  labId,
  labSlug,
  scenarios,
  scenarioKey,
  onScenario,
  document,
  catalog,
  lab,
  canWrite,
}: {
  labId: string;
  labSlug: string;
  scenarios: LabScenario[];
  scenarioKey: string;
  onScenario: (key: string) => void;
  document: BlockDocument;
  catalog: BlockCatalog;
  lab?: LabDetail;
  canWrite: boolean;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const editor = useDocumentEditor({
    labId,
    scenarioKey,
    initial: document,
    canWrite,
    onSaved: () => {
      void queryClient.invalidateQueries({ queryKey: labsKeys.detail(labId) });
      void queryClient.invalidateQueries({ queryKey: labsKeys.history(labId, document.scenario_id) });
    },
  });
  const { doc, change } = editor;
  const pages = useMemo(() => doc.pages ?? [], [doc.pages]);

  const [activePageId, setActivePageId] = useState(pages[0]?.id ?? "");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [palette, setPalette] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // A manual validation applies to the revision it ran against; a later save supersedes it.
  const [validation, setValidation] = useState<{ revision: number; issues: SchemaIssue[] } | null>(null);
  const [inspectorTab, setInspectorTab] = useState<"form" | "json">("form");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [previewPageId, setPreviewPageId] = useState("");
  const [flowOpen, setFlowOpen] = useState(false);

  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
  const selectedBlock = activePage?.blocks.find((block) => block.id === selectedBlockId) ?? null;
  const selectedType = catalog.items.find((item) => item.type === selectedBlock?.type);

  // Ctrl/Cmd+S saves immediately.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void editor.flush();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor]);

  const issues: SchemaIssue[] =
    validation && validation.revision === editor.revision
      ? validation.issues
      : editor.issues.map((issue) => ({ path: issue.path, message: issue.message, level: issue.level }));

  // ----- document edits (all local; the editor autosaves) -----

  const editPage = (pageId: string, update: (page: BlockPage) => BlockPage, key: string | null = null) =>
    change((current) => ({
      ...current,
      pages: current.pages.map((page) => (page.id === pageId ? update(page) : page)),
    }), key);

  const addBlock = (type: BlockTypeDef) => {
    if (!activePage) return;
    const id = uniqueBlockId(pages, type.type);
    const block: BlockNode = {
      id,
      type: type.type,
      props: structuredClone(type.defaults) as Record<string, unknown>,
      children: [],
      visible_when: [],
      admin_only: false,
      version: 1,
    };
    editPage(activePage.id, (page) => {
      const at = selectedBlockId ? page.blocks.findIndex((item) => item.id === selectedBlockId) : -1;
      const blocks = [...page.blocks];
      blocks.splice(at >= 0 ? at + 1 : blocks.length, 0, block);
      return { ...page, blocks };
    });
    setSelectedBlockId(id);
    setPalette(false);
  };

  const moveBlock = (blockId: string, delta: number) =>
    activePage &&
    editPage(activePage.id, (page) => {
      const from = page.blocks.findIndex((item) => item.id === blockId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= page.blocks.length) return page;
      const blocks = [...page.blocks];
      const [moved] = blocks.splice(from, 1);
      blocks.splice(to, 0, moved);
      return { ...page, blocks };
    });

  const moveBlockToPage = (blockId: string, targetPageId: string) => {
    if (!activePage || targetPageId === activePage.id) return;
    change((current) => {
      const source = current.pages.find((page) => page.id === activePage.id);
      const block = source?.blocks.find((item) => item.id === blockId);
      if (!block) return current;
      return {
        ...current,
        pages: current.pages.map((page) =>
          page.id === activePage.id
            ? { ...page, blocks: page.blocks.filter((item) => item.id !== blockId) }
            : page.id === targetPageId
              ? { ...page, blocks: [...page.blocks, block] }
              : page,
        ),
      };
    });
    setActivePageId(targetPageId);
  };

  const duplicateBlock = (blockId: string) =>
    activePage &&
    editPage(activePage.id, (page) => {
      const index = page.blocks.findIndex((item) => item.id === blockId);
      if (index < 0) return page;
      const copy = { ...structuredClone(page.blocks[index]), id: uniqueBlockId(pages, page.blocks[index].type) };
      const blocks = [...page.blocks];
      blocks.splice(index + 1, 0, copy);
      return { ...page, blocks };
    });

  const deleteBlock = (blockId: string) => {
    if (!activePage) return;
    editPage(activePage.id, (page) => ({ ...page, blocks: page.blocks.filter((item) => item.id !== blockId) }));
    if (selectedBlockId === blockId) setSelectedBlockId(null);
  };

  const updateBlock = (blockId: string, update: (block: BlockNode) => BlockNode, key: string) =>
    activePage &&
    editPage(activePage.id, (page) => ({
      ...page,
      blocks: page.blocks.map((item) => (item.id === blockId ? update(item) : item)),
    }), key);

  const addPage = () => {
    const id = uniquePageId(pages, `section-${pages.length + 1}`);
    change((current) => ({
      ...current,
      pages: [...current.pages, { id, title: { ar: "قسم جديد", en: "New section" }, blocks: [], show_in_trail: true }],
    }));
    setActivePageId(id);
    setPreviewPageId(id);
    setSelectedBlockId(null);
  };

  const movePage = (pageId: string, delta: number) =>
    change((current) => {
      const from = current.pages.findIndex((page) => page.id === pageId);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= current.pages.length) return current;
      const list = [...current.pages];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...current, pages: list };
    });

  const deletePage = (pageId: string) => {
    if (pages.length <= 1) return;
    change((current) => ({ ...current, pages: current.pages.filter((page) => page.id !== pageId) }));
    setSelectedBlockId(null);
    if (activePageId === pageId) {
      const next = pages.find((page) => page.id !== pageId);
      if (next) {
        setActivePageId(next.id);
        setPreviewPageId(next.id);
      }
    }
  };

  // ----- server actions -----

  const validate = useMutation({
    mutationFn: () =>
      validateBlockDocument(labId, { content: doc as unknown as Record<string, unknown>, scenario_key: scenarioKey }),
    onSuccess: (result) => {
      setValidation({
        revision: editor.revision,
        issues: [
          ...result.errors.map((issue) => ({ path: issue.path, message: issue.message, level: "error" as const })),
          ...result.warnings.map((issue) => ({ path: issue.path, message: issue.message, level: "warning" as const })),
        ],
      });
      toast[result.valid ? "success" : "error"](
        result.valid ? t("المستند صالح", "Document is valid") : t(`${result.errors.length} خطأ`, `${result.errors.length} error(s)`),
      );
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, BlockTypeDef[]>();
    for (const item of catalog.items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return [...map.entries()];
  }, [catalog.items]);

  // Live preview: the unsaved draft is posted into the storefront's `/preview/lab` frame, opened on
  // the active section. No API write happens; the runner scores a finish locally in studio mode.
  const previewRuntime = useMemo(() => {
    if (!previewOpen || !lab) return null;
    const labCard = lab.lab;
    return {
      lab_id: labCard.lab_id,
      version: labCard.published_version ?? 0,
      engine: "blocks",
      scorer: "server",
      card: {
        slug: labCard.slug,
        engine_key: "blocks",
        title: labCard.title,
        tagline: labCard.tagline,
        field_category_id: labCard.field_category_id,
        category_name: labCard.category_name,
        difficulty: labCard.difficulty,
        minutes: labCard.minutes,
        color: labCard.color,
        skills: labCard.skills,
      },
      definition: lab.definition,
      scenarios: scenarios.map((scenario) => ({
        key: scenario.key,
        title: scenario.title,
        weight: scenario.weight,
        sort_order: scenario.sort_order,
      })),
      scenario: {
        key: scenarioKey,
        title: document.scenario_title,
        schema_version: document.schema_version,
        catalog_version: document.catalog_version,
        content: {
          ...doc,
          pages,
          fields: doc.fields ?? [],
          personas: doc.personas ?? [],
        },
      },
      preview: true,
    };
  }, [previewOpen, lab, scenarios, scenarioKey, document, doc, pages]);

  const previewMessage = useMemo(
    () => (previewRuntime ? { type: "render", blocks: previewRuntime, page_id: previewPageId || activePage?.id || null } : null),
    [previewRuntime, previewPageId, activePage?.id],
  );
  const previewChannel = usePreviewChannel("/preview/lab", previewMessage);

  const blockIssues = selectedBlock
    ? issues
        .filter((issue) => issue.path.includes(`/blocks/${selectedBlock.id}/props`))
        .map((issue) => ({ ...issue, path: `/${issue.path.split("/props").at(-1)?.replace(/^\//, "") ?? ""}`.replace(/^\/$/, "") }))
    : [];
  const issueCount = (blockId: string) => issues.filter((issue) => issue.path.includes(`/blocks/${blockId}/`)).length;

  const documentSchema = catalog.document_schema as JsonSchema;
  const librarySchema = (name: "fields" | "personas", title: string): JsonSchema => ({
    ...(documentSchema.properties?.[name] ?? { type: "array" }),
    title,
    $defs: documentSchema.$defs,
  });
  const libraryIssues = (name: string) =>
    issues
      .filter((issue) => issue.path.startsWith(`/${name}`) || issue.path.startsWith(`${name}/`))
      .map((issue) => ({ ...issue, path: issue.path.startsWith("/") ? issue.path.slice(name.length + 1) : issue.path.slice(name.length) }));

  return (
    <>
      {previewOpen ? (
        <Card
          title={t("معاينة مباشرة للمسودة", "Live draft preview")}
          actions={
            <span className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
              <SelectField
                label={t("القسم", "Section")}
                value={previewPageId || activePage?.id || ""}
                onChange={setPreviewPageId}
                options={pages.map((page) => ({ value: page.id, label: page.title?.ar || page.id }))}
              />
              <Button sm kind={previewDevice === "desktop" ? "soft" : "ghost"} label={t("سطح المكتب", "Desktop")} onClick={() => setPreviewDevice("desktop")} />
              <Button sm kind={previewDevice === "mobile" ? "soft" : "ghost"} label={t("الهاتف", "Mobile")} onClick={() => setPreviewDevice("mobile")} />
              <Button sm kind="ghost" icon="refresh" label={t("إعادة التحميل", "Reload")} onClick={previewChannel.reload} />
            </span>
          }
        >
          <p className="ma-help">
            {t(
              "هذه معاينة حية للمسودة غير المنشورة. تعديلاتك تظهر بعد لحظات ولا تُنشئ محاولة أو تحليلات.",
              "This is a live preview of the unpublished draft. Edits appear after a moment and never write attempts or analytics.",
            )}
          </p>
          <StorefrontViewport
            frameRef={previewChannel.frameRef}
            url={previewChannel.url}
            ready={previewChannel.ready}
            blocked={previewChannel.blocked}
            device={previewDevice}
            title={t("معاينة المختبر", "Lab preview")}
            onLoad={previewChannel.notifyLoaded}
            onRetry={previewChannel.reload}
          />
        </Card>
      ) : null}

      {flowOpen ? (
        <ScenarioFlowPanel
          labId={labId}
          scenarioId={document.scenario_id}
          title={t("مسار السيناريو", "Scenario flow")}
          content={doc as unknown as Record<string, unknown>}
          dirty={editor.saveState !== "saved"}
          height={460}
          onFocus={(focus) => {
            if (focus.pageId) {
              setActivePageId(focus.pageId);
              setPreviewPageId(focus.pageId);
            }
            if (focus.blockId) setSelectedBlockId(focus.blockId);
          }}
        />
      ) : null}

      <Card
        title={t("محرّر الأقسام والبلوكات", "Section & block builder")}
        actions={
          <span className="ma-cell-flex" style={{ gap: 6, flexWrap: "wrap" }}>
            <SaveIndicator editor={editor} />
            <SelectField
              label={t("السيناريو", "Scenario")}
              value={scenarioKey}
              onChange={(key) => void editor.flush().then(() => onScenario(key))}
              options={scenarios.map((scenario) => ({ value: scenario.key, label: scenario.title || scenario.key }))}
            />
            <Button sm kind="ghost" label={t("تراجع", "Undo")} disabled={!canWrite || !editor.canUndo} onClick={editor.undo} />
            <Button sm kind="ghost" label={t("إعادة", "Redo")} disabled={!canWrite || !editor.canRedo} onClick={editor.redo} />
            <Button sm kind={showHistory ? "soft" : "ghost"} icon="history" label={t("السجل", "History")} onClick={() => setShowHistory((open) => !open)} />
            <Button
              sm
              kind={previewOpen ? "soft" : "ghost"}
              icon="eye"
              label={previewOpen ? t("إخفاء المعاينة", "Hide preview") : t("معاينة مباشرة", "Live preview")}
              disabled={!lab}
              onClick={() => setPreviewOpen((open) => !open)}
            />
            <Button
              sm
              kind={flowOpen ? "soft" : "ghost"}
              icon="layers"
              label={flowOpen ? t("إخفاء المسار", "Hide flow") : t("معاينة المسار", "Flow preview")}
              onClick={() => setFlowOpen((open) => !open)}
            />
            <Button
              sm
              kind="ghost"
              label={validate.isPending ? t("جارٍ التحقق…", "Validating…") : t("تحقق", "Validate")}
              disabled={validate.isPending}
              onClick={() => validate.mutate()}
            />
          </span>
        }
      >
        <p className="ma-help">
          {t(
            "التعديلات تُحفظ تلقائيًا بعد توقفك عن الكتابة (Ctrl+S للحفظ الآن، Ctrl+Z للتراجع). كل قسم يحمل بلوكات مكتوبة؛ اختر بلوكًا لتحرير خصائصه.",
            "Edits autosave once you pause (Ctrl+S saves now, Ctrl+Z undoes). Each section holds typed blocks; select a block to edit its props.",
          )}
          {" · "}
          <bdi>{labSlug}</bdi> · r{editor.revision}
        </p>

        {editor.saveState === "error" && editor.error ? (
          <Alert kind="danger" title={t("تعذّر الحفظ التلقائي", "Autosave failed")}>
            <p>{editor.error}</p>
            <Button sm kind="soft" label={t("أعد المحاولة", "Retry")} onClick={() => void editor.flush()} />
          </Alert>
        ) : null}

        {issues.length ? (
          <Alert kind={issues.some((issue) => issue.level === "error") ? "danger" : "warning"} title={t("ملاحظات التحقق", "Validation notes")}>
            <IssueList issues={issues.slice(0, 20)} />
          </Alert>
        ) : null}

        <div className="ma-cell-flex" role="tablist" style={{ gap: 6, flexWrap: "wrap", marginBlockEnd: "var(--space-3)" }}>
          {pages.map((page) => (
            <Button
              key={page.id}
              sm
              kind={page.id === activePage?.id ? "primary" : "ghost"}
              label={page.title?.ar || page.id}
              onClick={() => {
                setActivePageId(page.id);
                setPreviewPageId(page.id);
                setSelectedBlockId(null);
              }}
            />
          ))}
          {canWrite ? <Button sm kind="soft" icon="plus" label={t("قسم", "Section")} onClick={addPage} /> : null}
        </div>

        {activePage ? (
          <div style={{ display: "grid", gap: "var(--space-3)" }}>
            <div className="ma-cell-flex" style={{ gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 220px" }}>
                <Field
                  id="page-title-ar"
                  label={t("عنوان القسم", "Section title")}
                  value={activePage.title?.ar ?? ""}
                  readOnly={!canWrite}
                  onChange={(value) =>
                    editPage(activePage.id, (page) => ({ ...page, title: { ar: value, en: page.title?.en ?? null } }), `page-title:${activePage.id}`)
                  }
                />
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <Field
                  id="page-title-en"
                  label={t("العنوان بالإنجليزية", "English title")}
                  dir="ltr"
                  value={activePage.title?.en ?? ""}
                  readOnly={!canWrite}
                  onChange={(value) =>
                    editPage(activePage.id, (page) => ({ ...page, title: { ar: page.title?.ar ?? "", en: value || null } }), `page-title-en:${activePage.id}`)
                  }
                />
              </div>
              <label className="ma-check" style={{ gap: 6 }}>
                <input
                  type="checkbox"
                  checked={activePage.show_in_trail !== false}
                  disabled={!canWrite}
                  onChange={() => editPage(activePage.id, (page) => ({ ...page, show_in_trail: page.show_in_trail === false }))}
                />
                {t("يظهر في المسار", "Show in trail")}
              </label>
              {canWrite ? (
                <span className="ma-cell-flex" style={{ gap: 4 }}>
                  <Button sm kind="ghost" icon="up" label={t("قبل", "Earlier")} disabled={pages[0]?.id === activePage.id} onClick={() => movePage(activePage.id, -1)} />
                  <Button sm kind="ghost" icon="down" label={t("بعد", "Later")} disabled={pages.at(-1)?.id === activePage.id} onClick={() => movePage(activePage.id, 1)} />
                  <Button sm kind="ghost" icon="trash" label={t("حذف القسم", "Delete section")} disabled={pages.length <= 1} onClick={() => deletePage(activePage.id)} />
                </span>
              ) : null}
            </div>

            {activePage.blocks.length === 0 ? (
              <Empty
                text={t("القسم فارغ. أضف أول بلوك.", "Empty section. Add the first block.")}
                action={canWrite ? <Button sm kind="primary" label={t("إضافة بلوك", "Add block")} onClick={() => setPalette(true)} /> : undefined}
              />
            ) : (
              activePage.blocks.map((block, index) => {
                const definition = catalog.items.find((item) => item.type === block.type);
                const count = issueCount(block.id);
                const selected = selectedBlockId === block.id;
                return (
                  <div
                    key={block.id}
                    className="ma-cell-flex"
                    style={{
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "var(--space-3)",
                      border: selected ? "2px solid var(--accent)" : "1px solid var(--line)",
                      borderRadius: "var(--radius-control)",
                      background: "var(--surface)",
                    }}
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setSelectedBlockId(selected ? null : block.id)}
                      style={{ background: "none", border: 0, textAlign: "start", cursor: "pointer", flex: 1, color: "inherit" }}
                    >
                      <div className="ma-cell-flex" style={{ gap: 8, flexWrap: "wrap" }}>
                        <Badge def={{ label: { ar: definition?.label.ar ?? block.type, en: definition?.label.en ?? block.type }, tone: "info" }} />
                        <strong>{summaryOf(block, t)}</strong>
                        {block.admin_only ? <Badge def={{ label: { ar: "إداري", en: "Admin" }, tone: "warning" }} /> : null}
                        {count ? <Badge def={{ label: { ar: `${count} ملاحظة`, en: `${count} issue(s)` }, tone: "danger" }} /> : null}
                      </div>
                      <div className="ma-help">
                        <bdi>{block.id}</bdi> · {block.type}
                      </div>
                    </button>
                    {canWrite ? (
                      <div className="ma-cell-flex" style={{ gap: 4 }}>
                        <Button sm kind="ghost" icon="up" label={t("أعلى", "Up")} disabled={index === 0} onClick={() => moveBlock(block.id, -1)} />
                        <Button sm kind="ghost" icon="down" label={t("أسفل", "Down")} disabled={index === activePage.blocks.length - 1} onClick={() => moveBlock(block.id, 1)} />
                        <Button sm kind="ghost" icon="copy" label={t("نسخ", "Duplicate")} onClick={() => duplicateBlock(block.id)} />
                        <Button sm kind="ghost" icon="trash" label={t("حذف", "Delete")} onClick={() => deleteBlock(block.id)} />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
            {canWrite ? (
              <Button
                sm
                kind="soft"
                icon="plus"
                label={selectedBlock ? t("إضافة بلوك بعد المحدد", "Add block after selection") : t("إضافة بلوك", "Add block")}
                onClick={() => setPalette(true)}
              />
            ) : null}
          </div>
        ) : (
          <Empty text={t("لا صفحات في هذا السيناريو.", "This scenario has no sections.")} />
        )}
      </Card>

      {selectedBlock && selectedType ? (
        <Card
          title={t(`خصائص: ${selectedType.label.ar}`, `Props: ${selectedType.label.en}`)}
          actions={
            <span className="ma-cell-flex" style={{ gap: 6 }}>
              <Button sm kind={inspectorTab === "form" ? "soft" : "ghost"} label={t("نموذج", "Form")} onClick={() => setInspectorTab("form")} />
              <Button sm kind={inspectorTab === "json" ? "soft" : "ghost"} label="JSON" onClick={() => setInspectorTab("json")} />
              <Button sm kind="ghost" icon="x" label={t("إغلاق", "Close")} onClick={() => setSelectedBlockId(null)} />
            </span>
          }
        >
          <div className="ma-form-grid">
            <Field id="block-id" label={t("المعرّف", "Id")} value={selectedBlock.id} dir="ltr" readOnly onChange={() => undefined} />
            <Field id="block-type" label={t("النوع", "Type")} value={selectedBlock.type} dir="ltr" readOnly onChange={() => undefined} />
          </div>
          <div className="ma-cell-flex" style={{ gap: 12, flexWrap: "wrap", marginBlock: "var(--space-3)" }}>
            <label className="ma-check" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={Boolean(selectedBlock.admin_only)}
                disabled={!canWrite}
                onChange={() => updateBlock(selectedBlock.id, (block) => ({ ...block, admin_only: !block.admin_only }), `admin:${selectedBlock.id}`)}
              />
              {t("إداري فقط (لا يظهر للطالب)", "Admin only (never sent to learners)")}
            </label>
            {pages.length > 1 && canWrite ? (
              <SelectField
                label={t("نقل إلى قسم", "Move to section")}
                value=""
                onChange={(pageId) => pageId && moveBlockToPage(selectedBlock.id, pageId)}
                options={[
                  { value: "", label: t("اختر قسمًا…", "Choose a section…") },
                  ...pages.filter((page) => page.id !== activePage?.id).map((page) => ({ value: page.id, label: page.title?.ar || page.id })),
                ]}
              />
            ) : null}
          </div>
          <fieldset disabled={!canWrite} style={{ border: 0, padding: 0, margin: 0 }}>
            <SchemaForm
              key={`${selectedBlock.id}:${inspectorTab}`}
              schema={inspectorTab === "form" ? (selectedType.props_schema as JsonSchema) : { type: "object", additionalProperties: true }}
              value={selectedBlock.props}
              onChange={(props) =>
                updateBlock(selectedBlock.id, (block) => ({ ...block, props: props as Record<string, unknown> }), `props:${selectedBlock.id}`)
              }
              issues={blockIssues}
            />
          </fieldset>
          {blockIssues.length ? <IssueList issues={blockIssues} /> : null}
        </Card>
      ) : null}

      <Card title={t("مكتبة الحقول والأشخاص", "Fields & personas library")}>
        <p className="ma-help">
          {t(
            "الحقول تُعرَّف مرة واحدة ويشير إليها بلوك النموذج بمعرّفها؛ الأشخاص يُستخدمون في بلوكات الحوار. الحقائق المخفية والمحفزات لا تُرسل للطالب.",
            "Fields are defined once and referenced by id from form blocks; personas are used by dialogue blocks. Hidden facts and triggers are never sent to learners.",
          )}
        </p>
        <fieldset disabled={!canWrite} style={{ border: 0, padding: 0, margin: 0, display: "grid", gap: "var(--space-4)" }}>
          <div>
            <SchemaForm
              schema={librarySchema("fields", t("الحقول", "Fields"))}
              value={doc.fields ?? []}
              onChange={(fields) => change((current) => ({ ...current, fields: fields as unknown[] }), "library:fields")}
              issues={libraryIssues("fields")}
            />
          </div>
          <div>
            <SchemaForm
              schema={librarySchema("personas", t("الأشخاص", "Personas"))}
              value={doc.personas ?? []}
              onChange={(personas) => change((current) => ({ ...current, personas: personas as unknown[] }), "library:personas")}
              issues={libraryIssues("personas")}
            />
          </div>
        </fieldset>
      </Card>

      {showHistory ? (
        <HistoryPanel
          labId={labId}
          scenarioId={document.scenario_id}
          baseRevision={editor.revision}
          canWrite={canWrite}
          beforeRestore={editor.flush}
          onRestored={async () => {
            const latest = await getBlockDocument(labId, scenarioKey);
            editor.replace(latest);
            setSelectedBlockId(null);
            void queryClient.invalidateQueries({ queryKey: labsKeys.detail(labId) });
          }}
        />
      ) : null}

      <Modal
        open={palette}
        onOpenChange={setPalette}
        title={t("إضافة بلوك", "Add block")}
        size="lg"
        description={t("اختر نوع البلوك. تُملأ الخصائص الافتراضية ويمكنك تعديلها بعد الإضافة.", "Pick a block type. Defaults are filled; edit the props after adding.")}
      >
        {groups.map(([category, items]) => (
          <div key={category} className="ma-field">
            <span className="ma-label">{t(CATEGORY_LABEL[category]?.ar ?? category, CATEGORY_LABEL[category]?.en ?? category)}</span>
            <div className="ma-form-grid">
              {items.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="ma-btn ma-btn--soft"
                  style={{ justifyContent: "space-between", minHeight: 56 }}
                  onClick={() => addBlock(item)}
                >
                  <span>{t(item.label.ar, item.label.en)}</span>
                  <span className="ma-help">{item.type}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </Modal>

      <Modal
        open={editor.saveState === "conflict"}
        onOpenChange={() => undefined}
        title={t("تعديل متزامن", "Edited elsewhere")}
        description={t(
          "حفظ شخص آخر (أو تبويب آخر) هذا السيناريو بعد أن فتحته. اختر: تحميل نسخته وإلغاء تعديلاتك، أو حفظ نسختك فوقها (تبقى نسخته في السجل).",
          "Someone else (or another tab) saved this scenario after you opened it. Load their version and drop your edits, or save yours on top (theirs stays in the history).",
        )}
        footer={
          <>
            <Button kind="ghost" label={t("تحميل نسختهم", "Load theirs")} onClick={() => void editor.reload()} />
            <Button kind="primary" label={t("حفظ نسختي فوقها", "Keep mine")} onClick={() => void editor.overwrite()} />
          </>
        }
      >
        <span />
      </Modal>
    </>
  );
}

function summaryOf(block: BlockNode, t: (ar: string, en: string) => string): string {
  const props = block.props ?? {};
  for (const key of ["title", "prompt", "text", "label", "markdown"]) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 80);
    if (value && typeof value === "object" && typeof (value as { ar?: string }).ar === "string") {
      return (value as { ar: string }).ar.slice(0, 80);
    }
  }
  return t("بلوك", "Block");
}

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "block";
}

/** Block ids are unique across the whole document (the server validates that). */
function uniqueBlockId(pages: BlockPage[], type: string): string {
  const known = new Set(pages.flatMap((page) => page.blocks.map((block) => block.id)));
  let index = known.size + 1;
  while (known.has(`${slug(type)}-${index}`)) index += 1;
  return `${slug(type)}-${index}`;
}

function uniquePageId(pages: BlockPage[], title: string): string {
  const known = new Set(pages.map((page) => page.id));
  const base = slug(title);
  if (!known.has(base)) return base;
  let index = 2;
  while (known.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}


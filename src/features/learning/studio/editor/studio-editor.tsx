import { useEffect, useMemo, useRef } from "react";
import { filterSuggestionItems } from "@blocknote/core";
import * as locales from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { flip, offset, shift, size } from "@floating-ui/react";
import "@blocknote/mantine/style.css";

import { uploadStudioAsset } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { resolvedTheme, useThemeStore } from "@/lib/theme";
import { toEditorBlocks } from "@/features/learning/studio/model/document";
import {
  studioSchema,
  studioSlashItems,
  type StudioEditor as Editor,
} from "@/features/learning/studio/editor/schema";

function countTags(blocks: unknown[]): number {
  return (blocks as { type?: string; children?: unknown[] }[]).reduce(
    (count, block) => count + (block?.type === "tags" ? 1 : 0) + countTags(block?.children ?? []),
    0,
  );
}

/**
 * The Notion-like page editor: `/` opens the block menu (headings, lists, quote, image, table and the studio
 * blocks), the handle beside each block drags it or opens its menu, and pasted/dropped images upload to the
 * product's asset library. The editor is uncontrolled: `initialBlocks` is read once per `editorKey`.
 */
export function StudioEditor({
  productRef,
  editorKey,
  initialBlocks,
  dir,
  onChange,
  onReady,
  onOpenReadmeModal,
  uploadFile,
  page = "course",
}: {
  productRef: string;
  /** Changes when the draft is replaced (restore, reload); the editor is then rebuilt. */
  editorKey: string;
  initialBlocks: unknown[];
  dir: "rtl" | "ltr";
  onChange: (blocks: unknown[]) => void;
  onReady?: (editor: Editor | null) => void;
  onOpenReadmeModal?: () => void;
  /** Stores a pasted/dropped file and returns its URL; defaults to the product's asset library. */
  uploadFile?: (file: File) => Promise<string>;
  /** Which page the editor builds; sets the studio blocks offered in the `/` menu. */
  page?: "course" | "expert";
}) {
  const t = useT();
  const lang = useLang();
  const theme = resolvedTheme(useThemeStore((state) => state.theme));
  // The document last reported through `onChange`: a change event that leaves it as it was is not reported.
  const reported = useRef<string | null>(null);

  const editor = useCreateBlockNote(
    {
      schema: studioSchema,
      initialContent: initialBlocks.length ? toEditorBlocks(initialBlocks) : undefined,
      dictionary: lang === "ar" ? locales.ar : locales.en,
      uploadFile: uploadFile ?? (async (file: File) => (await uploadStudioAsset(productRef, file)).url),
    },
    [editorKey, lang],
  );

  // A freshly built editor holds the loaded document. When loading rewrote it ("المجالات: …" lines became `tags`
  // blocks), that is reported at once so the preview and the draft get the new blocks without waiting for an edit.
  useEffect(() => {
    reported.current = JSON.stringify(editor.document);
    if (countTags(editor.document) > countTags(initialBlocks)) onChange(editor.document as unknown[]);
    // Only once per editor: `initialBlocks` and `onChange` are read when it is built.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    queueMicrotask(() => {
      onReady?.(editor);
    });
    return () => {
      queueMicrotask(() => {
        onReady?.(null);
      });
    };
  }, [editor, onReady]);

  // Floating options to open the slash suggestion menu upper/above the line
  const slashFloatingOptions = useMemo(
    () => ({
      useFloatingOptions: {
        placement: "top-start" as const,
        middleware: [
          offset(10),
          flip({
            fallbackPlacements: ["bottom-start"],
            padding: 10,
          }),
          shift({ padding: 10 }),
          size({
            apply({ elements, availableHeight }) {
              elements.floating.style.maxHeight = `${Math.max(0, availableHeight)}px`;
            },
            padding: 10,
          }),
        ],
      },
    }),
    [],
  );

  return (
    <div className="ma-studio-editor" dir={dir}>
      <BlockNoteView
        editor={editor}
        theme={theme}
        slashMenu={false}
        onChange={() => {
          queueMicrotask(() => {
            const document = JSON.stringify(editor.document);
            if (document === reported.current) return;
            reported.current = document;
            onChange(editor.document as unknown[]);
          });
        }}
      >
        <SuggestionMenuController
          triggerCharacter="/"
          floatingUIOptions={slashFloatingOptions}
          getItems={async (query) =>
            filterSuggestionItems(
              [...getDefaultReactSlashMenuItems(editor), ...studioSlashItems(editor, t, onOpenReadmeModal, page)],
              query,
            )
          }
        />
      </BlockNoteView>
    </div>
  );
}

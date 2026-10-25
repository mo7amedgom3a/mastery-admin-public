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
  const isInitial = useRef(true);

  useEffect(() => {
    isInitial.current = true;
  }, [editorKey]);

  const editor = useCreateBlockNote(
    {
      schema: studioSchema,
      initialContent: initialBlocks.length ? toEditorBlocks(initialBlocks) : undefined,
      dictionary: lang === "ar" ? locales.ar : locales.en,
      uploadFile: uploadFile ?? (async (file: File) => (await uploadStudioAsset(productRef, file)).url),
    },
    [editorKey, lang],
  );

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
            if (isInitial.current) {
              isInitial.current = false;
              return;
            }
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

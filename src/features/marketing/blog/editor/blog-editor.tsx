import { useEffect, useMemo, useRef } from "react";
import { filterSuggestionItems } from "@blocknote/core";
import * as locales from "@blocknote/core/locales";
import { BlockNoteView } from "@blocknote/mantine";
import { getDefaultReactSlashMenuItems, SuggestionMenuController, useCreateBlockNote } from "@blocknote/react";
import { flip, offset, shift, size } from "@floating-ui/react";
import "@blocknote/mantine/style.css";

import { uploadBlogAsset } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import { resolvedTheme, useThemeStore } from "@/lib/theme";
import { toEditorBlocks } from "@/features/marketing/blog/model/document";
import {
  blogSchema,
  blogSlashItems,
  type BlogEditor as Editor,
} from "@/features/marketing/blog/editor/blog-schema";

/**
 * The blog article editor: `/` opens the block menu (headings, lists, quote, image, table and the blog blocks),
 * and pasted/dropped images upload to the post's asset library. Uncontrolled: `initialBlocks` is read once per
 * `editorKey`, so a restore or reload rebuilds it.
 */
export function BlogEditor({
  postId,
  editorKey,
  initialBlocks,
  dir,
  onChange,
  onReady,
  onOpenReadmeModal,
  uploadFile,
}: {
  postId: string;
  /** Changes when the draft is replaced (restore, reload); the editor is then rebuilt. */
  editorKey: string;
  initialBlocks: unknown[];
  dir: "rtl" | "ltr";
  onChange: (blocks: unknown[]) => void;
  onReady?: (editor: Editor | null) => void;
  onOpenReadmeModal?: () => void;
  /** Stores a pasted/dropped file and returns its URL; defaults to the post's asset library. */
  uploadFile?: (file: File) => Promise<string>;
}) {
  const t = useT();
  const lang = useLang();
  const theme = resolvedTheme(useThemeStore((state) => state.theme));
  // The document last reported through `onChange`: a change event that leaves it as it was is not reported.
  const reported = useRef<string | null>(null);

  const editor = useCreateBlockNote(
    {
      schema: blogSchema,
      initialContent: initialBlocks.length ? toEditorBlocks(initialBlocks) : undefined,
      dictionary: lang === "ar" ? locales.ar : locales.en,
      uploadFile: uploadFile ?? (async (file: File) => (await uploadBlogAsset(postId, file)).url),
    },
    [editorKey, lang],
  );

  useEffect(() => {
    reported.current = JSON.stringify(editor.document);
    // Only once per editor: `initialBlocks` is read when it is built.
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

  const slashFloatingOptions = useMemo(
    () => ({
      useFloatingOptions: {
        placement: "top-start" as const,
        middleware: [
          offset(10),
          flip({ fallbackPlacements: ["bottom-start"], padding: 10 }),
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
              [...getDefaultReactSlashMenuItems(editor), ...blogSlashItems(editor, t, onOpenReadmeModal)],
              query,
            )
          }
        />
      </BlockNoteView>
    </div>
  );
}

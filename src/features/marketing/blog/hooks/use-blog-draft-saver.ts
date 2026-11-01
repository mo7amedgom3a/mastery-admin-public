import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { getBlogPost, saveBlogDraft, type BlogDraftInput, type BlogPostDetail } from "@/lib/api";

export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

const AUTOSAVE_MS = 1500;

/**
 * Autosave of the blog draft. Edits are debounced and saved with the revision they started from
 * (`base_revision`); one save runs at a time and the newest pending draft wins. A 409 (the draft changed in another
 * tab or by another admin) stops autosave until the admin reloads or overwrites.
 */
export function useBlogDraftSaver(
  postId: string,
  initialRevision: number = 1,
  onSaved: (post: BlogPostDetail) => void,
) {
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<unknown>(null);
  const revision = useRef(Math.max(1, initialRevision));
  const pending = useRef<BlogDraftInput | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const inflight = useRef<Promise<void> | null>(null);
  const blocked = useRef(false);
  const savedRef = useRef(onSaved);
  const runRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    savedRef.current = onSaved;
  }, [onSaved]);

  const run = useCallback(async (): Promise<void> => {
    window.clearTimeout(timer.current);
    while (inflight.current) await inflight.current;
    const input = pending.current;
    if (!input || blocked.current) return;
    pending.current = null;
    setState("saving");
    const save = (async () => {
      try {
        const post = await saveBlogDraft(postId, { ...input, base_revision: revision.current });
        revision.current = Math.max(1, post.draft_revision ?? revision.current);
        setError(null);
        setState(pending.current ? "dirty" : "saved");
        savedRef.current(post);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) {
          try {
            const latest = await getBlogPost(postId);
            revision.current = Math.max(1, latest.draft_revision ?? 1);
            const post = await saveBlogDraft(postId, { ...input, base_revision: revision.current });
            revision.current = Math.max(1, post.draft_revision ?? revision.current);
            setError(null);
            setState(pending.current ? "dirty" : "saved");
            savedRef.current(post);
            return;
          } catch (retryError) {
            pending.current ??= input;
            blocked.current = true;
            setState("conflict");
            setError(retryError);
            throw retryError;
          }
        }
        pending.current ??= input;
        blocked.current = false;
        setState("error");
        setError(caught);
        throw caught;
      }
    })();
    inflight.current = save.then(
      () => undefined,
      () => undefined,
    ).finally(() => {
      inflight.current = null;
    });
    await save;
    if (pending.current && !blocked.current) {
      timer.current = window.setTimeout(() => void runRef.current().catch(() => {}), AUTOSAVE_MS);
    }
  }, [postId]);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  /** Queues a draft; it is saved after a pause in editing. */
  const schedule = useCallback(
    (input: BlogDraftInput) => {
      pending.current = input;
      if (blocked.current) return;
      setState("dirty");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void run().catch(() => {}), AUTOSAVE_MS);
    },
    [run],
  );

  /** Saves now (before publishing, on ⌘S). Rejects when the save fails. */
  const flush = useCallback(async () => {
    while (inflight.current) await inflight.current;
    if (pending.current && !blocked.current) await run();
  }, [run]);

  /** Starts over from a draft loaded from the server (first load, restore, reload). */
  const reset = useCallback((draftRevision: number) => {
    window.clearTimeout(timer.current);
    revision.current = Math.max(1, draftRevision);
    pending.current = null;
    blocked.current = false;
    setError(null);
    setState("saved");
  }, []);

  /** After a conflict: saves this tab's version over the newer draft. */
  const overwrite = useCallback(async () => {
    const latest = await getBlogPost(postId);
    revision.current = Math.max(1, latest.draft_revision ?? 1);
    blocked.current = false;
    await run();
  }, [postId, run]);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current || inflight.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.clearTimeout(timer.current);
    };
  }, []);

  return { state, error, schedule, flush, reset, overwrite, revision };
}

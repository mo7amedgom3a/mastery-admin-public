import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { getStudio, saveStudioDraft, type StudioContent, type StudioDocument } from "@/lib/api";

export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

const AUTOSAVE_MS = 1500;

/**
 * Autosave of the studio draft. Edits are debounced and saved with the revision they started from
 * (`base_revision`); one save runs at a time and the newest pending document wins. A 409 (the draft changed in
 * another tab or by another admin) stops autosave until the admin reloads or overwrites.
 */
export function useDraftSaver(
  productRef: string,
  initialRevision: number = 0,
  onSaved: (content: StudioContent) => void,
) {
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<unknown>(null);
  const revision = useRef(initialRevision);
  const pending = useRef<StudioDocument | null>(null);
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
    const document = pending.current;
    if (!document || blocked.current) return;
    pending.current = null;
    setState("saving");
    const save = (async () => {
      try {
        const content = await saveStudioDraft(productRef, { document, base_revision: revision.current });
        revision.current = content.draft_revision;
        setError(null);
        setState(pending.current ? "dirty" : "saved");
        savedRef.current(content);
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 409) {
          try {
            const latest = await getStudio(productRef);
            revision.current = latest.draft_revision;
            const content = await saveStudioDraft(productRef, { document, base_revision: latest.draft_revision });
            revision.current = content.draft_revision;
            setError(null);
            setState(pending.current ? "dirty" : "saved");
            savedRef.current(content);
            return;
          } catch (retryError) {
            pending.current ??= document;
            blocked.current = true;
            setState("conflict");
            setError(retryError);
            throw retryError;
          }
        }
        pending.current ??= document;
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
  }, [productRef]);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  /** Queues a document; it is saved after a pause in editing. */
  const schedule = useCallback(
    (document: StudioDocument) => {
      pending.current = document;
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
    revision.current = draftRevision;
    pending.current = null;
    blocked.current = false;
    setError(null);
    setState("saved");
  }, []);

  /** After a conflict: saves this tab's version over the newer draft. */
  const overwrite = useCallback(async () => {
    const latest = await getStudio(productRef);
    revision.current = latest.draft_revision;
    blocked.current = false;
    await run();
  }, [productRef, run]);

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

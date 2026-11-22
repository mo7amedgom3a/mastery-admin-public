import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api/client";
import { getBlockDocument, saveBlockDocument, type BlockDocument, type BlockDocumentContent, type LabIssue } from "@/lib/api";

/**
 * Local editing model for a `blocks` scenario document.
 *
 * Every edit changes the document in memory (instant UI, undo/redo) and is saved as a whole
 * document after a short pause (`PUT /admin/labs/{id}/document` with `base_revision`). The server
 * folds rapid saves into one history snapshot. A 409 means someone else saved meanwhile: the editor
 * stops autosaving and asks the admin to reload theirs or overwrite it with this version.
 */

export type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";

const AUTOSAVE_MS = 1200;
const MAX_HISTORY = 100;
// Consecutive edits to the same thing (typing in one prop) collapse into one undo step.
const COALESCE_MS = 1500;

type Options = {
  labId: string;
  scenarioKey: string;
  initial: BlockDocument;
  canWrite: boolean;
  onSaved?: (doc: BlockDocument) => void;
};

export function useDocumentEditor({ labId, scenarioKey, initial, canWrite, onSaved }: Options) {
  const [doc, setDoc] = useState<BlockDocumentContent>(() => initial.content as unknown as BlockDocumentContent);
  const [revision, setRevision] = useState(initial.revision);
  const [issues, setIssues] = useState<LabIssue[]>(initial.issues ?? []);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  // Undo/redo stacks live in refs; `stackSize` re-renders the toolbar when they change.
  const past = useRef<BlockDocumentContent[]>([]);
  const future = useRef<BlockDocumentContent[]>([]);
  const [stackSize, setStackSize] = useState({ past: 0, future: 0 });
  const syncStacks = () => setStackSize({ past: past.current.length, future: future.current.length });

  const docRef = useRef(doc);
  const revisionRef = useRef(revision);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const conflictRef = useRef(false);
  const lastEdit = useRef<{ key: string | null; at: number }>({ key: null, at: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  const save = useCallback(async (): Promise<void> => {
    if (!canWrite || savingRef.current || conflictRef.current || !dirtyRef.current) return;
    savingRef.current = true;
    dirtyRef.current = false;
    const content = docRef.current;
    setSaveState("saving");
    try {
      const next = await saveBlockDocument(labId, {
        content: content as unknown as Record<string, unknown>,
        base_revision: revisionRef.current,
        scenario_key: scenarioKey,
      });
      revisionRef.current = next.revision;
      setRevision(next.revision);
      setIssues(next.issues ?? []);
      setSavedAt(new Date());
      setError(null);
      onSavedRef.current?.(next);
      setSaveState(dirtyRef.current ? "dirty" : "saved");
    } catch (cause) {
      dirtyRef.current = true;
      if (cause instanceof ApiError && cause.status === 409) {
        conflictRef.current = true;
        setSaveState("conflict");
      } else {
        setSaveState("error");
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      savingRef.current = false;
    }
    // Edits made while the request was in flight.
    if (dirtyRef.current && !conflictRef.current) schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId, scenarioKey, canWrite]);

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || savingRef.current) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const commit = useCallback(
    (next: BlockDocumentContent, previous: BlockDocumentContent, key: string | null) => {
      const now = Date.now();
      const merge = key !== null && lastEdit.current.key === key && now - lastEdit.current.at < COALESCE_MS;
      lastEdit.current = { key, at: now };
      if (!merge) past.current = [...past.current.slice(-(MAX_HISTORY - 1)), previous];
      future.current = [];
      syncStacks();
      docRef.current = next;
      setDoc(next);
      dirtyRef.current = true;
      if (!conflictRef.current) {
        setSaveState("dirty");
        schedule();
      }
    },
    [schedule],
  );

  /** Apply an edit. `key` groups keystrokes on the same target into one undo step. */
  const change = useCallback(
    (updater: (current: BlockDocumentContent) => BlockDocumentContent, key: string | null = null) => {
      if (!canWrite) return;
      const previous = docRef.current;
      const next = updater(structuredClone(previous));
      if (JSON.stringify(next) === JSON.stringify(previous)) return;
      commit(next, previous, key);
    },
    [canWrite, commit],
  );

  const jump = useCallback(
    (target: BlockDocumentContent) => {
      lastEdit.current = { key: null, at: 0 };
      docRef.current = target;
      setDoc(target);
      dirtyRef.current = true;
      syncStacks();
      if (!conflictRef.current) {
        setSaveState("dirty");
        schedule();
      }
    },
    [schedule],
  );

  const undo = useCallback(() => {
    const previous = past.current.at(-1);
    if (!previous || !canWrite) return;
    past.current = past.current.slice(0, -1);
    future.current = [docRef.current, ...future.current].slice(0, MAX_HISTORY);
    jump(previous);
  }, [jump, canWrite]);

  const redo = useCallback(() => {
    const [next, ...rest] = future.current;
    if (!next || !canWrite) return;
    future.current = rest;
    past.current = [...past.current, docRef.current].slice(-MAX_HISTORY);
    jump(next);
  }, [jump, canWrite]);

  // Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z, Ctrl+Y. Native text undo wins while typing in a field.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  /** Save now (Ctrl+S / leaving the builder). */
  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    await save();
  }, [save]);

  /** Conflict: drop local edits and load the latest server version. */
  const reload = useCallback(async () => {
    const latest = await getBlockDocument(labId, scenarioKey);
    const content = latest.content as unknown as BlockDocumentContent;
    conflictRef.current = false;
    dirtyRef.current = false;
    docRef.current = content;
    revisionRef.current = latest.revision;
    setDoc(content);
    setRevision(latest.revision);
    setIssues(latest.issues ?? []);
    past.current = [];
    future.current = [];
    syncStacks();
    setSaveState("saved");
    onSavedRef.current?.(latest);
  }, [labId, scenarioKey]);

  /** Conflict: keep this version and save it on top of the latest server revision. */
  const overwrite = useCallback(async () => {
    const latest = await getBlockDocument(labId, scenarioKey);
    revisionRef.current = latest.revision;
    setRevision(latest.revision);
    conflictRef.current = false;
    dirtyRef.current = true;
    await save();
  }, [labId, scenarioKey, save]);

  /** A server-side change (history restore): adopt it as the new baseline. */
  const replace = useCallback((next: BlockDocument) => {
    const content = next.content as unknown as BlockDocumentContent;
    conflictRef.current = false;
    dirtyRef.current = false;
    docRef.current = content;
    revisionRef.current = next.revision;
    setDoc(content);
    setRevision(next.revision);
    setIssues(next.issues ?? []);
    past.current = [];
    future.current = [];
    syncStacks();
    setSaveState("saved");
  }, []);

  return {
    doc,
    revision,
    issues,
    setIssues,
    saveState,
    error,
    savedAt,
    change,
    undo,
    redo,
    canUndo: stackSize.past > 0,
    canRedo: stackSize.future > 0,
    flush,
    reload,
    overwrite,
    replace,
  };
}

export type DocumentEditor = ReturnType<typeof useDocumentEditor>;

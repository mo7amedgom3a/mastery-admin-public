import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { LabGraph } from "@/lib/api";

type GraphFetcher<T> = (payload: T, signal: AbortSignal) => Promise<LabGraph>;

type Options<T> = {
  build: GraphFetcher<T>;
  payload: T;
  enabled?: boolean;
  debounceMs?: number;
};

/**
 * Debounced, abortable graph preview.
 *
 * The Studio sends the in-memory draft; every edit gets a new JSON signature and a short pause
 * before the request. The last good graph stays on screen while the next one builds, and aborted
 * (superseded) requests never update state. Graph endpoints are read-only, so this cannot create
 * revisions or conflicts.
 */
export function useGraphPreview<T>({ build, payload, enabled = true, debounceMs = 450 }: Options<T>) {
  const [graph, setGraph] = useState<LabGraph | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const payloadRef = useRef(payload);
  const hasGraph = useRef(false);
  const signature = useMemo(() => JSON.stringify(payload), [payload]);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const delay = hasGraph.current ? debounceMs : 0;
    const timer = window.setTimeout(() => {
      setPending(true);
      build(payloadRef.current, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          hasGraph.current = true;
          setGraph(next);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return;
          if (cause instanceof DOMException && cause.name === "AbortError") return;
          setError(cause instanceof Error ? cause : new Error(String(cause)));
        })
        .finally(() => {
          if (!controller.signal.aborted) setPending(false);
        });
    }, delay);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [build, debounceMs, enabled, reloadKey, signature]);

  const reload = useCallback(() => setReloadKey((value) => value + 1), []);

  return { graph, pending, error, reload };
}

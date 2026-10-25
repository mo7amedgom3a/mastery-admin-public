import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/*
 * A storefront page (mastery-front `/preview/*`) in an iframe, driven by postMessage. The frame says `ready`, then
 * the admin posts its draft on every change (throttled). Messages are only sent to, and accepted from, the
 * storefront origin.
 */

export const STOREFRONT_ORIGIN: string =
  (import.meta.env.VITE_STOREFRONT_ORIGIN as string | undefined) ?? "http://localhost:3000";
const THROTTLE_MS = 150;

export type PreviewDevice = "desktop" | "mobile";

type FromPreview = { source: "mastery-preview"; type: "ready" | "rendered" };

export type PreviewChannel = {
  frameRef: RefObject<HTMLIFrameElement | null>;
  url: string;
  ready: boolean;
  /** The storefront never said `ready`: it is down or does not allow framing. */
  blocked: boolean;
  /** Posts a one-off message (e.g. scroll) once the frame is ready. */
  post: (data: Record<string, unknown>) => void;
};

/** Connects to `/preview/{path}` and re-posts `message` (memoize it) whenever it changes. */
export function usePreviewChannel(path: string, message: Record<string, unknown> | null): PreviewChannel {
  const url = `${STOREFRONT_ORIGIN.replace(/\/$/, "")}${path}`;
  const origin = new URL(url).origin;
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  // Bumped on every `ready`, so a reloaded frame gets the current draft again.
  const [handshake, setHandshake] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const readyRef = useRef(false);
  const last = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const onMessage = (event: MessageEvent<FromPreview>) => {
      if (event.origin !== origin || event.data?.source !== "mastery-preview") return;
      if (event.data.type === "ready") {
        readyRef.current = true;
        setReady(true);
        setHandshake((n) => n + 1);
      }
    };
    window.addEventListener("message", onMessage);
    const watchdog = window.setTimeout(() => setBlocked(!readyRef.current), 8000);
    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(watchdog);
    };
  }, [origin]);

  const post = useCallback(
    (data: Record<string, unknown>) => frame.current?.contentWindow?.postMessage({ source: "mastery-studio", ...data }, origin),
    [origin],
  );

  useEffect(() => {
    if (!ready || !message) return;
    const send = () => {
      last.current = Date.now();
      post(message);
    };
    window.clearTimeout(timer.current);
    const wait = THROTTLE_MS - (Date.now() - last.current);
    if (wait <= 0) send();
    else timer.current = window.setTimeout(send, wait);
    return () => window.clearTimeout(timer.current);
  }, [ready, handshake, message, post]);

  return { frameRef: frame, url, ready, blocked, post };
}

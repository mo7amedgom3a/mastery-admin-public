import { createContext, useContext } from "react";

import type { StudioAsset, StudioMeta } from "@/lib/api";

/** A product a `programCards` block can feature (the expert Studio passes the expert's own items). */
export type StudioProgramOption = { slug: string; title: string; product_type: string; image?: string | null };

/** What custom blocks need from the studio page: the asset picker, the page's instructors and its programs. */
export type StudioEditorContext = {
  productRef: string;
  /** Opens the asset library in pick mode; resolves with the chosen asset (null when cancelled). */
  pickAsset: (kind?: "image" | "video" | "file") => Promise<Pick<StudioAsset, "url" | "alt_text"> | null>;
  instructors: NonNullable<StudioMeta["instructors"]>;
  /** Products `programCards` blocks may feature; the block is offered only when this is set. */
  programs?: StudioProgramOption[];
};

export const StudioContext = createContext<StudioEditorContext | null>(null);

export function useStudioContext(): StudioEditorContext {
  const value = useContext(StudioContext);
  if (!value) throw new Error("useStudioContext must be used inside a studio");
  return value;
}

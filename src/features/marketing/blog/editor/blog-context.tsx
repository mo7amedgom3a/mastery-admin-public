import { createContext, useContext } from "react";

import type { BlogAsset } from "@/lib/api";

/** What the blog blocks need from the studio page: the post's asset picker (cover, banner images). */
export type BlogEditorContextValue = {
  postId: string;
  /** Opens the post's asset library in pick mode; resolves with the chosen asset (null when cancelled). */
  pickAsset: (kind?: "image" | "video") => Promise<Pick<BlogAsset, "url" | "alt_text"> | null>;
};

export const BlogEditorContext = createContext<BlogEditorContextValue | null>(null);

export function useBlogEditorContext(): BlogEditorContextValue | null {
  return useContext(BlogEditorContext);
}

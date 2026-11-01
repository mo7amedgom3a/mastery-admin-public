import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/client";

/*
 * Blog (`/admin/blog`): posts authored as BlockNote documents, saved as a draft with an optimistic lock
 * (`base_revision`, 409 when stale) and published as numbered versions that email the subscribers. Assets upload
 * straight to storage with a presigned URL, then are recorded with their key. The storefront reads the public
 * `/blog/*` routes; this module only talks to the admin API.
 */

export type BlogPostStatus = "draft" | "published" | "archived";
export type BlogSubscriberStatus = "active" | "unsubscribed";

export type BlogAuthor = {
  instructor_id: string;
  /** Instructor key used by the storefront expert pages (legacy id or UUID). */
  key: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
};

export type BlogCategory = {
  category_id: string;
  slug: string;
  name: string;
  sort_order: number;
  post_count?: number;
};

export type BlogCoverImage = { url: string; alt: string };

/** A BlockNote block (props are scalars; list props are JSON strings on the custom blocks). */
export type BlogBlock = {
  id?: string;
  type: string;
  props?: Record<string, string | number | boolean | null>;
  content?: unknown;
  children?: BlogBlock[];
};

export type BlogDocumentMeta = {
  title: string;
  summary: string;
  cover: BlogCoverImage | null;
  tags: string[];
};

export type BlogDocument = {
  schema_version: number;
  meta: BlogDocumentMeta;
  blocks: BlogBlock[];
};

export type BlogPostListItem = {
  post_id: string;
  slug: string;
  title: string;
  summary: string;
  cover_image_url: string | null;
  cover_image_alt: string | null;
  status: BlogPostStatus;
  published_at: string | null;
  reading_minutes: number | null;
  views_count: number;
  author: BlogAuthor | null;
  categories: BlogCategory[];
  tags: string[];
};

/** One post with its draft document; `document` is `{}` until the first save. */
export type BlogPostDetail = BlogPostListItem & {
  document: Partial<BlogDocument>;
  readme_source: string | null;
  draft_revision: number | null;
  published_revision: number | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string | null;
  updated_at: string | null;
  related: BlogPostListItem[];
};

export type BlogPostPage = { items: BlogPostListItem[]; total: number; page: number; page_size: number };

export type BlogVersion = {
  version_id: string;
  version_number: number;
  note: string | null;
  published_by: string | null;
  published_at: string;
  title: string;
  summary: string;
};

export type BlogAsset = {
  asset_id: string;
  url: string;
  filename: string | null;
  content_type: string | null;
  size_bytes: number | null;
  alt_text: string | null;
  created_at: string;
};

export type BlogAssetPage = { items: BlogAsset[]; total: number };

export type BlogUploadIntent = {
  upload_url: string;
  method: string;
  headers: Record<string, string>;
  bucket: string;
  key: string;
  public_url: string;
  content_type: string;
  expires_in: number;
};

export type BlogPublishResult = {
  post: BlogPostDetail;
  version_number: number;
  notifications_queued: number;
  notifications_sent: number;
  revalidated: boolean;
};

export type BlogSubscriber = {
  subscriber_id: string;
  email: string;
  status: BlogSubscriberStatus;
  source: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
};

export type BlogSubscriberPage = { items: BlogSubscriber[]; total: number; page: number; page_size: number };

export type BlogNotificationStats = {
  total: number;
  pending: number;
  sending: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type BlogNotifyResult = { posts: number; sent: number; pending: number; disabled: number };

/** The storefront data the live preview renders under the draft (`kind: blog-post`). */
export type BlogPreviewBase = { kind: string; base: unknown };

export type BlogPostsParams = { status?: BlogPostStatus; q?: string; page?: number; page_size?: number };
export type BlogSubscribersParams = { status?: BlogSubscriberStatus; q?: string; page?: number; page_size?: number };

export type BlogDraftInput = {
  document: BlogDocument;
  readme_source?: string | null;
  category_ids: string[];
  slug?: string | null;
  author_instructor_id?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

export type BlogDraftRequest = BlogDraftInput & { base_revision: number };

export type BlogPublishRequest = { base_revision?: number; note?: string | null; notify_subscribers?: boolean };

export type BlogCategoryInput = { slug: string; name: string; sort_order: number };

export const blogPaths = {
  posts: "admin/blog/posts",
  post: "admin/blog/posts/{post_id}",
  draft: "admin/blog/posts/{post_id}/draft",
  publish: "admin/blog/posts/{post_id}/publish",
  unpublish: "admin/blog/posts/{post_id}/unpublish",
  versions: "admin/blog/posts/{post_id}/versions",
  restore: "admin/blog/posts/{post_id}/versions/{version_id}/restore",
  assets: "admin/blog/posts/{post_id}/assets",
  uploadUrl: "admin/blog/posts/{post_id}/assets/upload-url",
  directUpload: "admin/blog/posts/{post_id}/assets/upload",
  asset: "admin/blog/posts/{post_id}/assets/{asset_id}",
  previewBase: "admin/blog/posts/{post_id}/preview-base",
  categories: "admin/blog/categories",
  category: "admin/blog/categories/{category_id}",
  authors: "admin/blog/authors",
  subscribers: "admin/blog/subscribers",
  subscriber: "admin/blog/subscribers/{subscriber_id}",
  notifications: "admin/blog/posts/{post_id}/notifications",
  notify: "admin/blog/posts/{post_id}/notify",
  dispatchNotifications: "admin/blog/notifications/dispatch",
} as const;

export const blogKeys = {
  all: ["marketing", "blog"] as const,
  posts: (params?: BlogPostsParams) => [...blogKeys.all, "posts", params ?? {}] as const,
  post: (postId: string) => [...blogKeys.all, "post", postId] as const,
  versions: (postId: string) => [...blogKeys.all, "versions", postId] as const,
  assets: (postId: string) => [...blogKeys.all, "assets", postId] as const,
  categories: () => [...blogKeys.all, "categories"] as const,
  authors: () => [...blogKeys.all, "authors"] as const,
  subscribers: (params?: BlogSubscribersParams) => [...blogKeys.all, "subscribers", params ?? {}] as const,
  notificationStats: (postId: string) => [...blogKeys.all, "notifications", postId] as const,
  previewBase: (postId: string) => [...blogKeys.all, "preview-base", postId] as const,
};

// --- posts -------------------------------------------------------------------

export function listBlogPosts(params: BlogPostsParams = {}): Promise<BlogPostPage> {
  return apiGet(blogPaths.posts, { query: params });
}

export function getBlogPost(postId: string): Promise<BlogPostDetail> {
  return apiGet(blogPaths.post, { path: { post_id: postId } });
}

export function createBlogPost(body: {
  title: string;
  slug?: string | null;
  author_instructor_id?: string | null;
}): Promise<BlogPostDetail> {
  return apiPost(blogPaths.posts, { body });
}

/** `PUT .../draft` — replaces the draft; 409 when it changed since `base_revision`. */
export function saveBlogDraft(postId: string, body: BlogDraftRequest): Promise<BlogPostDetail> {
  return apiPut(blogPaths.draft, { path: { post_id: postId }, body });
}

/** `POST .../publish` — snapshots the draft, queues subscriber emails and revalidates the storefront. */
export function publishBlogPost(postId: string, body: BlogPublishRequest = {}): Promise<BlogPublishResult> {
  return apiPost(blogPaths.publish, { path: { post_id: postId }, body });
}

/** `POST .../unpublish` — moves a published post back to `archived`. */
export function unpublishBlogPost(postId: string): Promise<BlogPostDetail> {
  return apiPost(blogPaths.unpublish, { path: { post_id: postId }, body: {} });
}

/** `DELETE ...` — only draft/archived posts can be deleted. */
export function deleteBlogPost(postId: string): Promise<void> {
  return apiDelete(blogPaths.post, { path: { post_id: postId } });
}

/** `GET .../versions` — published versions, newest first. */
export async function getBlogVersions(postId: string): Promise<BlogVersion[]> {
  const response = await apiGet<{ items: BlogVersion[] }>(blogPaths.versions, { path: { post_id: postId } });
  return response.items;
}

/** `POST .../versions/{id}/restore` — copies a version into the draft. */
export function restoreBlogVersion(postId: string, versionId: string): Promise<BlogPostDetail> {
  return apiPost(blogPaths.restore, { path: { post_id: postId, version_id: versionId }, body: {} });
}

// --- assets ------------------------------------------------------------------

export function listBlogAssets(
  postId: string,
  query: { limit?: number; offset?: number } = {},
): Promise<BlogAssetPage> {
  return apiGet(blogPaths.assets, { path: { post_id: postId }, query });
}

export function requestBlogAssetUpload(
  postId: string,
  body: { filename: string; content_type: string | null; size_bytes: number },
): Promise<BlogUploadIntent> {
  return apiPost(blogPaths.uploadUrl, { path: { post_id: postId }, body });
}

export function completeBlogAssetUpload(
  postId: string,
  body: { key: string; filename?: string | null; alt_text?: string | null },
): Promise<BlogAsset> {
  return apiPost(blogPaths.assets, { path: { post_id: postId }, body });
}

export function deleteBlogAsset(postId: string, assetId: string): Promise<void> {
  return apiDelete(blogPaths.asset, { path: { post_id: postId, asset_id: assetId } });
}

/** Direct upload through the backend (used as fallback when the browser cannot PUT to S3). */
export async function uploadBlogAssetDirect(postId: string, file: File, altText?: string): Promise<BlogAsset> {
  const query: Record<string, string> = { filename: file.name };
  if (file.type) query.content_type = file.type;
  if (altText) query.alt_text = altText;
  return apiPost(blogPaths.directUpload, {
    path: { post_id: postId },
    query,
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
}

/** Uploads a file to the post's assets: presigned PUT straight to storage, with automatic backend fallback. */
export async function uploadBlogAsset(postId: string, file: File, altText?: string): Promise<BlogAsset> {
  try {
    const intent = await requestBlogAssetUpload(postId, {
      filename: file.name,
      content_type: file.type || null,
      size_bytes: file.size,
    });
    const headers = new Headers(intent.headers || {});
    if (intent.content_type && !headers.has("Content-Type")) {
      headers.set("Content-Type", intent.content_type);
    }
    const response = await fetch(intent.upload_url, {
      method: intent.method || "PUT",
      headers,
      body: file,
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(`S3 direct upload failed (${response.status}): ${errorText || response.statusText}`);
    }
    return await completeBlogAssetUpload(postId, {
      key: intent.key,
      filename: file.name,
      alt_text: altText ?? null,
    });
  } catch {
    return uploadBlogAssetDirect(postId, file, altText);
  }
}

// --- categories, authors, subscribers, notifications -------------------------

export function getBlogAuthors(): Promise<BlogAuthor[]> {
  return apiGet(blogPaths.authors);
}

export function listBlogCategories(): Promise<BlogCategory[]> {
  return apiGet(blogPaths.categories);
}

export function createBlogCategory(body: BlogCategoryInput): Promise<BlogCategory> {
  return apiPost(blogPaths.categories, { body });
}

export function updateBlogCategory(categoryId: string, body: BlogCategoryInput): Promise<BlogCategory> {
  return apiPatch(blogPaths.category, { path: { category_id: categoryId }, body });
}

export function deleteBlogCategory(categoryId: string): Promise<void> {
  return apiDelete(blogPaths.category, { path: { category_id: categoryId } });
}

export function getBlogSubscribers(params: BlogSubscribersParams = {}): Promise<BlogSubscriberPage> {
  return apiGet(blogPaths.subscribers, { query: params });
}

export function deleteBlogSubscriber(subscriberId: string): Promise<void> {
  return apiDelete(blogPaths.subscriber, { path: { subscriber_id: subscriberId } });
}

export function getBlogNotificationStats(postId: string): Promise<BlogNotificationStats> {
  return apiGet(blogPaths.notifications, { path: { post_id: postId } });
}

export function notifyBlogSubscribers(postId: string): Promise<BlogNotifyResult> {
  return apiPost(blogPaths.notify, { path: { post_id: postId }, body: {} });
}

/** Drain the queue for every post (the scheduled worker does this too; this is the manual retry). */
export function dispatchAllBlogNotifications(): Promise<BlogNotifyResult> {
  return apiPost(blogPaths.dispatchNotifications, { body: {} });
}

export function getBlogPreviewBase(postId: string): Promise<BlogPreviewBase> {
  return apiGet(blogPaths.previewBase, { path: { post_id: postId } });
}

export const blogQueries = {
  posts: (params?: BlogPostsParams) =>
    queryOptions({ queryKey: blogKeys.posts(params), queryFn: () => listBlogPosts(params) }),
  post: (postId: string) =>
    queryOptions({ queryKey: blogKeys.post(postId), queryFn: () => getBlogPost(postId) }),
  versions: (postId: string) =>
    queryOptions({ queryKey: blogKeys.versions(postId), queryFn: () => getBlogVersions(postId) }),
  assets: (postId: string) =>
    queryOptions({ queryKey: blogKeys.assets(postId), queryFn: () => listBlogAssets(postId, { limit: 200 }) }),
  categories: () =>
    queryOptions({ queryKey: blogKeys.categories(), queryFn: listBlogCategories, staleTime: 60_000 }),
  authors: () =>
    queryOptions({ queryKey: blogKeys.authors(), queryFn: getBlogAuthors, staleTime: 60_000 }),
  subscribers: (params?: BlogSubscribersParams) =>
    queryOptions({ queryKey: blogKeys.subscribers(params), queryFn: () => getBlogSubscribers(params) }),
  notificationStats: (postId: string) =>
    queryOptions({
      queryKey: blogKeys.notificationStats(postId),
      queryFn: () => getBlogNotificationStats(postId),
      staleTime: 30_000,
    }),
  previewBase: (postId: string) =>
    queryOptions({
      queryKey: blogKeys.previewBase(postId),
      queryFn: () => getBlogPreviewBase(postId),
      retry: false,
      staleTime: 5 * 60_000,
    }),
};

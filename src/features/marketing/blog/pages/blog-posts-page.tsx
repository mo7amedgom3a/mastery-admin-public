import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Mail, ExternalLink, PenLine, Send, Trash2, Undo2 } from "lucide-react";

import {
  blogKeys,
  blogQueries,
  createBlogPost,
  deleteBlogPost,
  notifyBlogSubscribers,
  publishBlogPost,
  unpublishBlogPost,
  type BlogPostListItem,
  type BlogPostStatus,
} from "@/lib/api";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { AppLink } from "@/components/ui/app-link";
import { Badge, Button, Card, Empty, ErrorAlert, IconButton, Loading, PageHead } from "@/components/ui/kit";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Modal } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchBox } from "@/components/ui/paged-list";
import { Pagination } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import "../blog.css";

const STATUS_LABEL: Record<BlogPostStatus, { ar: string; en: string; tone: "neutral" | "success" | "warning" }> = {
  draft: { ar: "مسودة", en: "Draft", tone: "warning" },
  published: { ar: "منشور", en: "Published", tone: "success" },
  archived: { ar: "مؤرشف", en: "Archived", tone: "neutral" },
};

type StatusFilter = "all" | BlogPostStatus;
const PAGE_SIZE = 20;

export default function BlogPostsPage() {
  const t = useT();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editable = can("marketing.write");

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<BlogPostListItem | null>(null);

  const posts = useQuery(
    blogQueries.posts({
      ...(status === "all" ? {} : { status }),
      ...(search.trim() ? { q: search.trim() } : {}),
      page,
      page_size: PAGE_SIZE,
    }),
  );
  const rows = posts.data?.items ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: blogKeys.all });

  const publish = useMutation({
    mutationFn: (postId: string) => publishBlogPost(postId, { notify_subscribers: false }),
    onSuccess: (result) => {
      toast.success(
        t(`نُشر المقال (النسخة ${result.version_number}).`, `Post published (version ${result.version_number}).`),
        t("لم تُرسل رسائل بريد من هذه القائمة؛ استخدم الاستوديو لإشعار المشتركين.", "No emails were sent from this list; use the studio to notify subscribers."),
      );
      invalidate();
    },
    onError: (error) => toast.error(t("تعذّر النشر", "Couldn't publish"), error instanceof Error ? error.message : undefined),
  });

  const unpublish = useMutation({
    mutationFn: (postId: string) => unpublishBlogPost(postId),
    onSuccess: () => {
      toast.success(t("أُلغي نشر المقال وأصبح مؤرشفاً.", "Post unpublished and archived."));
      invalidate();
    },
    onError: (error) => toast.error(t("تعذّر إلغاء النشر", "Couldn't unpublish"), error instanceof Error ? error.message : undefined),
  });

  const remove = useMutation({
    mutationFn: (postId: string) => deleteBlogPost(postId),
    onSuccess: () => {
      toast.success(t("حُذف المقال.", "Post deleted."));
      setToDelete(null);
      invalidate();
    },
    onError: (error) => toast.error(t("تعذّر الحذف", "Couldn't delete"), error instanceof Error ? error.message : undefined),
  });

  const columns: Column<BlogPostListItem>[] = [
    {
      key: "title",
      header: t("العنوان", "Title"),
      cell: (post) => (
        <AppLink className="ma-link ma-link--plain" to={`/marketing/blog/${post.post_id}/studio`}>
          <span className="ma-cell-main">{post.title || t("(بدون عنوان)", "(untitled)")}</span>
          <span className="ma-cell-sub"><bdi>{post.slug}</bdi></span>
        </AppLink>
      ),
      exportValue: (post) => post.title,
    },
    {
      key: "author",
      header: t("المؤلف", "Author"),
      cell: (post) => post.author?.name ?? "—",
      exportValue: (post) => post.author?.name ?? "",
    },
    {
      key: "categories",
      header: t("التصنيفات", "Categories"),
      cell: (post) =>
        post.categories.length ? (
          <span className="ma-blog-chips">
            {post.categories.map((category) => (
              <span key={category.category_id} className="ma-tag ma-tag--soft">{category.name}</span>
            ))}
          </span>
        ) : (
          "—"
        ),
      exportValue: (post) => post.categories.map((category) => category.name).join("، "),
    },
    {
      key: "status",
      header: t("الحالة", "Status"),
      cell: (post) => (
        <div className="ma-blog-status">
          <Badge def={{ label: { ar: STATUS_LABEL[post.status].ar, en: STATUS_LABEL[post.status].en }, tone: STATUS_LABEL[post.status].tone }} />
          <PendingNotifications postId={post.post_id} enabled={post.status === "published"} />
        </div>
      ),
      exportValue: (post) => t(STATUS_LABEL[post.status].ar, STATUS_LABEL[post.status].en),
    },
    {
      key: "updated",
      header: t("آخر تعديل", "Last updated"),
      cell: (post) => formatDateTime(post.published_at ?? null) || "—",
      sortValue: (post) => post.published_at ?? null,
      exportValue: (post) => post.published_at ?? "",
    },
    {
      key: "actions",
      header: t("إجراءات", "Actions"),
      exportable: false,
      cell: (post) => (
        <div className="ma-blog-actions">
          <IconButton iconNode={<PenLine size={15} />} label={t("فتح الاستوديو", "Open studio")} onClick={() => navigate(`/marketing/blog/${post.post_id}/studio`)} />
          {editable && post.status !== "published" ? (
            <IconButton
              iconNode={<Send size={15} />}
              label={t("نشر", "Publish")}
              disabled={publish.isPending || !post.title}
              onClick={() => publish.mutate(post.post_id)}
            />
          ) : null}
          {editable && post.status === "published" ? (
            <IconButton iconNode={<Undo2 size={15} />} label={t("إلغاء النشر", "Unpublish")} disabled={unpublish.isPending} onClick={() => unpublish.mutate(post.post_id)} />
          ) : null}
          {editable ? (
            <IconButton
              iconNode={<Trash2 size={15} />}
              label={post.status === "published" ? t("ألغِ النشر أولاً للحذف", "Unpublish before deleting") : t("حذف", "Delete")}
              disabled={post.status === "published"}
              onClick={() => setToDelete(post)}
            />
          ) : null}
        </div>
      ),
    },
  ];

  const tabs: [StatusFilter, string, string][] = [
    ["all", "الكل", "All"],
    ["draft", "مسودة", "Draft"],
    ["published", "منشور", "Published"],
    ["archived", "مؤرشف", "Archived"],
  ];

  return (
    <>
      <PageHead
        title={t("المدونة", "Blog")}
        sub={t(
          "مقالات المدونة كما تُنشر على الموقع: اكتب المسودة في الاستوديو، ثم انشرها وأشعر المشتركين.",
          "Blog posts as published on the storefront: write the draft in the studio, publish it and notify subscribers.",
        )}
        actions={
          editable ? (
            <Button kind="primary" icon="plus" label={t("مقال جديد", "New post")} onClick={() => setCreating(true)} />
          ) : null
        }
      />

      <Card flush>
        <div className="ma-toolbar">
          <SearchBox
            value={search}
            placeholder={t("ابحث في عنوان المقال أو رابطه…", "Search title or slug…")}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
          />
        </div>
      </Card>

      <div className="ma-pagetabs" role="tablist" aria-label={t("تصفية بالحالة", "Filter by status")} style={{ marginBlock: "var(--space-3)" }}>
        {tabs.map(([value, ar, en]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {t(ar, en)}
          </button>
        ))}
      </div>

      {posts.isLoading ? <Loading /> : null}
      {posts.error ? <ErrorAlert error={posts.error} title={t("تعذّر تحميل المقالات", "Couldn't load posts")} /> : null}
      {!posts.isLoading && !posts.error && rows.length === 0 ? (
        <Card>
          <Empty
            text={t("لا توجد مقالات مطابقة.", "No matching posts.")}
            action={editable ? <Button kind="primary" icon="plus" label={t("مقال جديد", "New post")} onClick={() => setCreating(true)} /> : null}
          />
        </Card>
      ) : null}
      {rows.length > 0 ? (
        <Card flush>
          <DataTable columns={columns} rows={rows} />
          {posts.data ? (
            <Pagination
              total={posts.data.total}
              limit={posts.data.page_size}
              offset={(posts.data.page - 1) * posts.data.page_size}
              onPage={(offset) => setPage(Math.floor(offset / PAGE_SIZE) + 1)}
            />
          ) : null}
        </Card>
      ) : null}

      <NewPostDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(postId) => {
          setCreating(false);
          invalidate();
          navigate(`/marketing/blog/${postId}/studio`);
        }}
      />

      <ConfirmModal
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        tone="danger"
        title={t("حذف المقال", "Delete post")}
        message={t(`سيُحذف «${toDelete?.title ?? ""}» نهائياً مع مسودته ونسخه.`, `"${toDelete?.title ?? ""}" will be deleted permanently with its draft and versions.`)}
        confirmLabel={t("حذف", "Delete")}
        loading={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.post_id)}
      />
    </>
  );
}

/**
 * Published posts keep a queue of subscriber emails. The scheduled worker drains it, but the badge
 * doubles as a manual retry: click it to send what is still pending (or to see the server's answer
 * when notifications are switched off).
 */
function PendingNotifications({ postId, enabled }: { postId: string; enabled: boolean }) {
  const t = useT();
  const queryClient = useQueryClient();
  const stats = useQuery({ ...blogQueries.notificationStats(postId), enabled });
  const send = useMutation({
    mutationFn: () => notifyBlogSubscribers(postId),
    onSuccess: (result) => {
      if (result.disabled) {
        toast.info(t("الإشعارات معطّلة على الخادم", "Email notifications are disabled on the server"));
      } else if (result.sent > 0) {
        toast.success(
          t(`تم إرسال ${result.sent} بريد${result.pending ? ` · ${result.pending} قيد الانتظار` : ""}`,
            `Sent ${result.sent} email${result.pending ? ` · ${result.pending} pending` : ""}`),
        );
      } else {
        toast.info(t("لا توجد رسائل جاهزة للإرسال الآن", "Nothing queued to send right now"));
      }
      void queryClient.invalidateQueries({ queryKey: blogKeys.notificationStats(postId) });
      void queryClient.invalidateQueries({ queryKey: [...blogKeys.all, "posts"] });
    },
    onError: (error) =>
      toast.error(t("تعذّر إرسال الإشعارات", "Couldn't send the notifications"), error instanceof Error ? error.message : undefined),
  });
  if (!enabled || !stats.data) return null;
  const pending = stats.data.pending + stats.data.sending + stats.data.failed;
  if (pending <= 0) return null;
  return (
    <button
      type="button"
      className="ma-badge ma-badge--info"
      title={t("اضغط لإرسال الرسائل المعلّقة", "Click to send the pending emails")}
      onClick={() => send.mutate()}
      disabled={send.isPending}
    >
      <Mail size={11} aria-hidden />
      {send.isPending ? t("جارٍ الإرسال…", "Sending…") : t(`${pending} بريد معلّق`, `${pending} emails pending`)}
    </button>
  );
}

function NewPostDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (postId: string) => void;
}) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [authorId, setAuthorId] = useState("");
  const authors = useQuery({ ...blogQueries.authors(), enabled: open });

  const create = useMutation({
    mutationFn: () =>
      createBlogPost({
        title: title.trim(),
        slug: slug.trim() || null,
        author_instructor_id: authorId || null,
      }),
    onSuccess: (post) => {
      toast.success(t("أُنشئ المقال. ابدأ الكتابة في الاستوديو.", "Post created. Start writing in the studio."));
      setTitle("");
      setSlug("");
      setAuthorId("");
      onCreated(post.post_id);
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={t("مقال جديد", "New post")}
      size="md"
      footer={
        <div className="ma-studio-actions">
          <Button
            kind="primary"
            icon="check"
            label={create.isPending ? t("جارٍ الإنشاء…", "Creating…") : t("إنشاء وفتح الاستوديو", "Create & open studio")}
            disabled={create.isPending || !title.trim()}
            onClick={() => create.mutate()}
          />
          <Button kind="ghost" label={t("إلغاء", "Cancel")} onClick={onClose} />
        </div>
      }
    >
      <div className="ma-studio-meta">
        <div className="ma-field">
          <label className="ma-label" htmlFor="blog-new-title">
            {t("العنوان", "Title")} <span aria-hidden="true" className="ma-req">*</span>
          </label>
          <input
            id="blog-new-title"
            className="ma-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("عنوان المقال…", "Post title…")}
            autoFocus
          />
        </div>
        <div className="ma-field">
          <label className="ma-label" htmlFor="blog-new-slug">
            {t("الرابط (اختياري)", "Slug (optional)")}
          </label>
          <input
            id="blog-new-slug"
            className="ma-input"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={t("my-post-title", "my-post-title")}
            dir="ltr"
          />
          <span className="ma-help">{t("إن تركته فارغاً يُشتق من العنوان.", "Left empty, it is derived from the title.")}</span>
        </div>
        <div className="ma-field">
          <span className="ma-label">{t("المؤلف", "Author")}</span>
          <SelectField
            label={t("المؤلف", "Author")}
            value={authorId}
            onChange={setAuthorId}
            size="md"
            fullWidth
            options={[
              { value: "", label: t("بدون مؤلف", "No author") },
              ...(authors.data ?? []).map((author) => ({ value: author.instructor_id, label: author.name })),
            ]}
          />
        </div>
        <ErrorAlert error={create.error} title={t("تعذّر إنشاء المقال", "Couldn't create the post")} />
        <p className="ma-blog-hint">
          <ExternalLink size={12} aria-hidden /> {t("سيفتح الاستوديو مباشرة بعد الإنشاء.", "The studio opens right after creating.")}
        </p>
      </div>
    </Modal>
  );
}

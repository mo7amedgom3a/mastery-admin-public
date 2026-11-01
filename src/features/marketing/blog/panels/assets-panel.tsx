import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Film, Trash2, Upload } from "lucide-react";

import { ErrorAlert, Loading } from "@/components/ui/kit";
import { toast } from "@/components/ui/toast";
import {
  blogKeys,
  blogQueries,
  deleteBlogAsset,
  uploadBlogAsset,
  type BlogAsset,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm";

function isImage(asset: BlogAsset): boolean {
  return Boolean(asset.content_type?.startsWith("image/"));
}

function isVideo(asset: BlogAsset): boolean {
  return Boolean(asset.content_type?.startsWith("video/"));
}

/**
 * The post's uploaded media. In pick mode a click chooses a file instead of copying its link. Files can be uploaded
 * with the button or dropped anywhere on the panel.
 */
export function BlogAssetLibrary({
  postId,
  kind,
  editable = true,
  onPick,
}: {
  postId: string;
  kind?: "image" | "video";
  editable?: boolean;
  onPick?: (asset: BlogAsset) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const assets = useQuery(blogQueries.assets(postId));

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const done: BlogAsset[] = [];
      for (const file of files) done.push(await uploadBlogAsset(postId, file));
      return done;
    },
    onSuccess: (done) => {
      queryClient.invalidateQueries({ queryKey: blogKeys.assets(postId) });
      if (done.length) toast.success(t("تم رفع الملف.", "File uploaded."));
      if (onPick && done.length > 0) onPick(done[0]);
    },
  });

  const remove = useMutation({
    mutationFn: (assetId: string) => deleteBlogAsset(postId, assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: blogKeys.assets(postId) });
      toast.success(t("تم حذف الملف.", "File deleted."));
    },
  });

  const items = (assets.data?.items ?? []).filter(
    (item) => !kind || (kind === "image" ? isImage(item) : isVideo(item)),
  );

  const takeFiles = (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (list.length) upload.mutate(list);
  };

  return (
    <div
      className={`ma-assets${dragging ? " is-dragging" : ""}`}
      onDragOver={(event) => {
        if (!editable) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        if (!editable) return;
        event.preventDefault();
        setDragging(false);
        takeFiles(event.dataTransfer.files);
      }}
    >
      {editable ? (
        <div className="ma-assets__bar">
          <button type="button" className="ma-sblock__btn" disabled={upload.isPending} onClick={() => input.current?.click()}>
            <Upload size={14} aria-hidden /> {upload.isPending ? t("جارٍ الرفع…", "Uploading…") : t("رفع ملفات", "Upload files")}
          </button>
          <span className="ma-blog-hint">{t("أو أفلت الصور هنا.", "Or drop images here.")}</span>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            accept={kind === "image" ? "image/*" : ACCEPT}
            onChange={(event) => {
              takeFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>
      ) : null}
      <ErrorAlert error={upload.error ?? remove.error ?? assets.error} />
      {assets.isLoading ? <Loading /> : null}
      {!assets.isLoading && !items.length ? (
        <p className="ma-assets__empty">
          {t("لا توجد ملفات بعد. ارفع صوراً لاستخدامها في المقال.", "No files yet. Upload images to use in the article.")}
        </p>
      ) : null}
      <ul className="ma-assets__grid">
        {items.map((asset) => (
          <li key={asset.asset_id} className="ma-assets__item">
            <button
              type="button"
              className="ma-assets__thumb"
              title={asset.filename ?? asset.url}
              onClick={() => {
                if (onPick) return onPick(asset);
                void navigator.clipboard?.writeText(asset.url);
                setCopied(asset.asset_id);
              }}
            >
              {isImage(asset) ? (
                <img src={asset.url} alt={asset.alt_text ?? ""} loading="lazy" />
              ) : isVideo(asset) ? (
                <Film size={22} aria-hidden />
              ) : (
                <FileText size={22} aria-hidden />
              )}
              <span className="ma-assets__name">
                {copied === asset.asset_id && !onPick ? t("تم نسخ الرابط", "Link copied") : (asset.filename ?? asset.url)}
              </span>
            </button>
            {!onPick && editable ? (
              <div className="ma-assets__actions">
                <a
                  href={asset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ma-assets__action"
                  title={t("فتح", "Open")}
                  aria-label={t("فتح", "Open")}
                  onClick={(event) => event.stopPropagation()}
                >
                  <ExternalLink size={14} aria-hidden />
                </a>
                <button
                  type="button"
                  className="ma-assets__action ma-assets__action--danger"
                  aria-label={t("حذف", "Delete")}
                  disabled={remove.isPending}
                  onClick={(event) => {
                    event.stopPropagation();
                    remove.mutate(asset.asset_id);
                  }}
                >
                  <Trash2 size={14} aria-hidden />
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Modal asset picker used by the cover picker and the banner block. */
export function BlogAssetPickerDialog({
  postId,
  kind,
  onClose,
}: {
  postId: string;
  kind?: "image" | "video";
  onClose: (asset: BlogAsset | null) => void;
}) {
  const t = useT();
  return (
    <div className="ma-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose(null)}>
      <div
        className="ma-studio-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("اختر ملفاً", "Choose a file")}
        onKeyDown={(event) => event.key === "Escape" && onClose(null)}
      >
        <div className="ma-studio-dialog__head">
          <strong>{t("مكتبة وسائط المقال", "Post assets")}</strong>
          <button type="button" className="ma-sblock__btn" onClick={() => onClose(null)}>
            {t("إغلاق", "Close")}
          </button>
        </div>
        <BlogAssetLibrary postId={postId} kind={kind} onPick={(asset) => onClose(asset)} />
      </div>
    </div>
  );
}

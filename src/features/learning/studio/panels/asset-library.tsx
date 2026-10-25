import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileText, Film, Trash2, Upload } from "lucide-react";

import { ErrorAlert, Loading } from "@/components/ui/kit";
import { deleteStudioAsset, studioKeys, studioQueries, uploadStudioAsset, type StudioAsset } from "@/lib/api";
import { useT } from "@/lib/i18n";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,video/mp4,video/webm,application/pdf";

/** The product's uploaded files. In pick mode a click chooses a file instead of copying its link. */
export function AssetLibrary({
  productRef,
  kind,
  onPick,
}: {
  productRef: string;
  kind?: "image" | "video" | "file";
  onPick?: (asset: StudioAsset) => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const assets = useQuery(studioQueries.assets(productRef));

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const done: StudioAsset[] = [];
      for (const file of files) done.push(await uploadStudioAsset(productRef, file));
      return done;
    },
    onSuccess: (done) => {
      queryClient.invalidateQueries({ queryKey: studioKeys.assets(productRef) });
      if (onPick && done.length > 0) {
        onPick(done[0]);
      }
    },
  });

  const remove = useMutation({
    mutationFn: (assetId: string) => deleteStudioAsset(productRef, assetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: studioKeys.assets(productRef) }),
  });

  const items = (assets.data?.items ?? []).filter((item) => !kind || item.kind === kind);

  return (
    <div className="ma-assets">
      <div className="ma-assets__bar">
        <button type="button" className="ma-sblock__btn" disabled={upload.isPending} onClick={() => input.current?.click()}>
          <Upload size={14} aria-hidden /> {upload.isPending ? t("جارٍ الرفع…", "Uploading…") : t("رفع ملفات", "Upload files")}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept={kind === "image" ? "image/*" : ACCEPT}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length) upload.mutate(files);
          }}
        />
      </div>
      <ErrorAlert error={upload.error ?? remove.error ?? assets.error} />
      {assets.isLoading ? <Loading /> : null}
      {!assets.isLoading && !items.length ? (
        <p className="ma-assets__empty">{t("لا توجد ملفات بعد. ارفع صورًا لاستخدامها في الصفحة.", "No files yet. Upload images to use on the page.")}</p>
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
              {asset.kind === "image" ? (
                <img src={asset.url} alt={asset.alt_text ?? ""} loading="lazy" />
              ) : asset.kind === "video" ? (
                <Film size={22} aria-hidden />
              ) : (
                <FileText size={22} aria-hidden />
              )}
              <span className="ma-assets__name">
                {copied === asset.asset_id && !onPick ? t("تم نسخ الرابط", "Link copied") : asset.filename}
              </span>
            </button>
            {!onPick ? (
              <div className="ma-assets__actions">
                {asset.url ? (
                  <a
                    href={asset.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ma-assets__action"
                    title={t("فتح / تنزيل", "Open / Download")}
                    aria-label={t("فتح / تنزيل", "Open / Download")}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={14} aria-hidden />
                  </a>
                ) : null}
                <button
                  type="button"
                  className="ma-assets__action ma-assets__action--danger"
                  aria-label={t("حذف", "Delete")}
                  disabled={remove.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
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


/** Modal asset picker used by the meta panel and the image blocks. */
export function AssetPickerDialog({
  productRef,
  kind,
  onClose,
}: {
  productRef: string;
  kind?: "image" | "video" | "file";
  onClose: (asset: StudioAsset | null) => void;
}) {
  const t = useT();
  return (
    <div className="ma-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose(null)}>
      <div
        className="ma-studio-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("اختر ملفًا", "Choose a file")}
        onKeyDown={(event) => event.key === "Escape" && onClose(null)}
      >
        <div className="ma-studio-dialog__head">
          <strong>{t("مكتبة الملفات", "Asset library")}</strong>
          <button type="button" className="ma-sblock__btn" onClick={() => onClose(null)}>
            {t("إغلاق", "Close")}
          </button>
        </div>
        <AssetLibrary productRef={productRef} kind={kind} onPick={(asset) => onClose(asset)} />
      </div>
    </div>
  );
}

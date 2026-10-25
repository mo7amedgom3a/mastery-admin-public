import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ChevronUp,
  GripVertical,
  ImageIcon,
  Info,
  Mail,
  MapPin,
  Phone,
  Upload,
  UserRound,
  X,
} from "lucide-react";

import { ErrorAlert, Field } from "@/components/ui/kit";
import { ReactPhotoEditor } from "react-photo-editor";
import {
  getAdminInstructor,
  listAdminInstructors,
  studioKeys,
  uploadStudioAsset,
  type AdminInstructor,
  type StudioAsset,
  type StudioMeta,
} from "@/lib/api";
import { useT } from "@/lib/i18n";

type Instructor = NonNullable<StudioMeta["instructors"]>[number];

/** The images the product page shows today, used as a preview until the admin picks one. */
export type MetaPanelCurrent = {
  cover?: { url: string; alt?: string } | null;
  banner?: { url: string; alt?: string; headline?: string } | null;
};

const TRAINER_REF = /^legacy:trainer:(\d+)$/;

function legacyTrainerId(ref: string): number | null {
  const match = TRAINER_REF.exec(ref);
  return match ? Number(match[1]) : null;
}

/** Plain text of a trainer bio (the legacy fields are HTML). */
function plainText(value: string | null | undefined): string {
  if (!value) return "";
  if (typeof document === "undefined") {
    return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  const element = document.createElement("div");
  element.innerHTML = value;
  return (element.textContent ?? "").replace(/\s+/g, " ").trim();
}

function yearsLabel(value: unknown): string | null {
  const years = typeof value === "number" ? value : value == null || value === "" ? null : Number(value);
  return years !== null && Number.isFinite(years) && years >= 0 ? `${years}` : null;
}

/**
 * Page details shown above the content: title, summary, cover, banner, intro video and instructors. Empty
 * fields keep what the storefront shows today (the legacy course's own values).
 */
export function MetaPanel({
  meta,
  productRef,
  current,
  instructorDetails = [],
  onChange,
  pickAsset,
}: {
  meta: StudioMeta;
  productRef?: string;
  /** The product's current live images, shown as a fallback in the empty pickers. */
  current?: MetaPanelCurrent | null;
  /** Current trainers of the product (with their bio/contact details), from the product API. */
  instructorDetails?: AdminInstructor[];
  onChange: (meta: StudioMeta) => void;
  pickAsset: (kind?: "image") => Promise<StudioAsset | null>;
}) {
  const t = useT();
  const set = (patch: Partial<StudioMeta>) => onChange({ ...meta, ...patch });
  const instructors = meta.instructors ?? [];

  const currentCover = current?.cover ?? null;
  const currentBanner: { url: string; alt?: string; headline?: string } | null =
    current?.banner ?? current?.cover ?? null;

  return (
    <div className="ma-studio-meta">
      <Field id="studio-title" label={t("العنوان", "Title")} value={meta.title ?? ""} onChange={(title) => set({ title })} />
      <Field
        id="studio-summary"
        type="textarea"
        rows={4}
        label={t("الملخص", "Summary")}
        hint={t("يظهر تحت العنوان في رأس الصفحة.", "Shown under the title in the page header.")}
        value={meta.summary ?? ""}
        onChange={(summary) => set({ summary })}
      />

      <ImagePicker
        label={t("صورة الغلاف", "Cover image")}
        value={meta.cover ?? null}
        fallback={currentCover}
        onUseFallback={() =>
          currentCover && set({ cover: { url: currentCover.url, alt: currentCover.alt ?? meta.title ?? "" } })
        }
        productRef={productRef}
        onPick={async () => {
          const asset = await pickAsset("image");
          if (asset) set({ cover: { asset_id: asset.asset_id, url: asset.url, alt: asset.alt_text ?? meta.title ?? "" } });
        }}
        onUploaded={(asset) => {
          set({ cover: { asset_id: asset.asset_id, url: asset.url, alt: asset.alt_text ?? meta.title ?? "" } });
        }}
        onClear={() => set({ cover: null })}
        onAlt={(alt) => meta.cover && set({ cover: { ...meta.cover, alt } })}
      />

      <ImagePicker
        label={t("بانر الصفحة", "Page banner")}
        value={meta.banner ?? null}
        fallback={currentBanner}
        onUseFallback={() =>
          currentBanner &&
          set({
            banner: {
              url: currentBanner.url,
              alt: currentBanner.alt ?? "",
              headline: meta.banner?.headline ?? currentBanner.headline ?? "",
            },
          })
        }
        productRef={productRef}
        onPick={async () => {
          const asset = await pickAsset("image");
          if (asset) {
            set({ banner: { asset_id: asset.asset_id, url: asset.url, alt: asset.alt_text ?? "", headline: meta.banner?.headline ?? "" } });
          }
        }}
        onUploaded={(asset) => {
          set({ banner: { asset_id: asset.asset_id, url: asset.url, alt: asset.alt_text ?? "", headline: meta.banner?.headline ?? "" } });
        }}
        onClear={() => set({ banner: null })}
        onAlt={(alt) => meta.banner && set({ banner: { ...meta.banner, alt } })}
      >
        {meta.banner ? (
          <input
            className="ma-input"
            placeholder={t("عنوان البانر", "Banner headline")}
            value={meta.banner.headline ?? ""}
            onChange={(event) => meta.banner && set({ banner: { ...meta.banner, headline: event.target.value } })}
          />
        ) : null}
      </ImagePicker>

      <Field
        id="studio-video"
        label={t("فيديو تعريفي (Bunny)", "Intro video (Bunny)")}
        hint={t("معرّف الفيديو في مكتبة Bunny Stream.", "The video's Bunny Stream GUID.")}
        value={meta.intro_video_id ?? ""}
        onChange={(value) => set({ intro_video_id: value.trim() || null })}
      />

      <InstructorsEditor
        value={instructors}
        details={instructorDetails}
        onChange={(next) => set({ instructors: next })}
      />
    </div>
  );
}

function ImagePicker({
  label,
  value,
  fallback,
  onUseFallback,
  productRef,
  onPick,
  onUploaded,
  onClear,
  onAlt,
  children,
}: {
  label: string;
  value: { url: string; alt?: string } | null;
  fallback?: { url: string; alt?: string } | null;
  onUseFallback?: () => void;
  productRef?: string;
  onPick: () => void;
  onUploaded?: (asset: StudioAsset) => void;
  onClear: () => void;
  onAlt: (alt: string) => void;
  children?: React.ReactNode;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [editingFile, setEditingFile] = useState<File | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const usingFallback = !value && Boolean(fallback);
  const shown = value ?? fallback ?? null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !productRef) return;
    setUploadError(null);
    setEditingFile(file);
    setIsEditorOpen(true);
  };

  const handleSaveEditedImage = async (editedFile: File) => {
    setIsEditorOpen(false);
    setEditingFile(null);
    if (!productRef) return;
    setUploading(true);
    setUploadError(null);
    try {
      const asset = await uploadStudioAsset(productRef, editedFile);
      queryClient.invalidateQueries({ queryKey: studioKeys.assets(productRef) });
      onUploaded?.(asset);
    } catch (err) {
      setUploadError(err);
    } finally {
      setUploading(false);
    }
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setEditingFile(null);
  };

  const editorLabels = {
    close: t("إلغاء", "Cancel"),
    save: t("حفظ", "Save"),
    rotate: t("تدوير", "Rotate"),
    brightness: t("السطوع", "Brightness"),
    contrast: t("التباين", "Contrast"),
    saturate: t("التشبع", "Saturation"),
    grayscale: t("تدرج رمادي", "Grayscale"),
    reset: t("إعادة ضبط", "Reset"),
    flipHorizontal: t("قلب أفقي", "Flip horizontal"),
    flipVertical: t("قلب رأسي", "Flip vertical"),
    zoomIn: t("تكبير", "Zoom in"),
    zoomOut: t("تصغير", "Zoom out"),
    draw: t("رسم", "Draw"),
    brushColor: t("لون الفرشاة", "Brush color"),
    brushWidth: t("حجم الفرشاة", "Brush width"),
  };

  return (
    <div className="ma-field">
      <span className="ma-label">{label}</span>
      <div className="ma-studio-image">
        <button
          type="button"
          className="ma-studio-image__thumb"
          onClick={usingFallback && onUseFallback ? onUseFallback : onPick}
          aria-label={usingFallback ? t("استخدام الصورة الحالية", "Use current image") : label}
          title={usingFallback ? t("الصورة المعروضة على الصفحة حالياً", "The image currently live on the page") : undefined}
        >
          {shown ? <img src={shown.url} alt={shown.alt ?? ""} /> : <ImageIcon size={22} aria-hidden />}
        </button>
        <div className="ma-studio-image__side">
          {usingFallback ? (
            <>
              <span className="ma-muted" style={{ flexBasis: "100%", fontSize: 12 }}>
                {t("الصورة الحالية على الصفحة", "Currently live on the page")}
              </span>
              <button type="button" className="ma-sblock__btn" onClick={onUseFallback}>
                {t("استخدام الصورة الحالية", "Use current image")}
              </button>
            </>
          ) : null}
          {productRef ? (
            <>
              <button
                type="button"
                className="ma-sblock__btn"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} aria-hidden />
                {uploading ? t("جارٍ الرفع…", "Uploading…") : t("رفع صورة", "Upload image")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFileChange}
              />
            </>
          ) : null}
          <button type="button" className="ma-sblock__btn" onClick={onPick}>
            {value ? t("من المكتبة", "From library") : t("اختر من المكتبة", "Choose from library")}
          </button>
          {value ? (
            <button type="button" className="ma-sblock__btn" onClick={onClear}>
              {t("إزالة", "Remove")}
            </button>
          ) : null}
        </div>
      </div>
      {uploadError ? <ErrorAlert error={uploadError} /> : null}
      {value ? (
        <input className="ma-input" placeholder={t("نص بديل", "Alt text")} value={value.alt ?? ""} onChange={(event) => onAlt(event.target.value)} />
      ) : null}
      {children}

      {isEditorOpen && editingFile ? (
        <ReactPhotoEditor
          open={isEditorOpen}
          onClose={handleCloseEditor}
          file={editingFile}
          onSaveImage={handleSaveEditedImage}
          downloadOnSave={false}
          allowColorEditing={true}
          allowRotate={true}
          allowFlip={true}
          allowZoom={true}
          allowDrawing={false}
          labels={editorLabels}
        />
      ) : null}
    </div>
  );
}

function InstructorsEditor({
  value,
  details,
  onChange,
}: {
  value: Instructor[];
  details: AdminInstructor[];
  onChange: (value: Instructor[]) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const detailsById = new Map(details.map((item) => [item.legacy_trainer_id, item]));
  const search = useQuery({
    queryKey: ["learning", "studio", "instructor-search", query],
    queryFn: () => listAdminInstructors({ query: query || undefined, limit: 8 }),
    enabled: query.trim().length >= 2,
  });

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const add = (item: AdminInstructor) => {
    const ref = `legacy:trainer:${item.legacy_trainer_id}`;
    if (value.some((current) => current.ref === ref)) return;
    onChange([
      ...value,
      {
        ref,
        display_name: item.name ?? "",
        avatar_url: item.avatar?.startsWith("https://") ? item.avatar : null,
      },
    ]);
    setQuery("");
  };

  const hasRef = (item: AdminInstructor) =>
    value.some((current) => current.ref === `legacy:trainer:${item.legacy_trainer_id}`);
  const notSelected = details.filter((item) => !hasRef(item));

  return (
    <div className="ma-field">
      <span className="ma-label">{t("المدربون", "Instructors")}</span>
      <span className="ma-muted" style={{ fontSize: 12 }}>
        {t("اضغط ⓘ لعرض نبذة المدرب وبياناته.", "Press ⓘ to see the trainer's bio and details.")}
      </span>
      <ol className="ma-studio-list">
        {value.map((item, index) => (
          <InstructorRow
            key={item.ref}
            item={item}
            detail={detailsById.get(legacyTrainerId(item.ref) ?? -1)}
            index={index}
            total={value.length}
            dragging={dragging === index}
            onDragStart={() => setDragging(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragging !== null) move(dragging, index);
              setDragging(null);
            }}
            onDragEnd={() => setDragging(null)}
            onMoveUp={() => move(index, index - 1)}
            onMoveDown={() => move(index, index + 1)}
            onRemove={() => onChange(value.filter((_, i) => i !== index))}
          />
        ))}
      </ol>

      {notSelected.length > 0 ? (
        <div className="ma-field" style={{ marginBlockEnd: 8 }}>
          <span className="ma-label">{t("المدربون الحاليون على الصفحة", "Instructors currently on the page")}</span>
          <ul className="ma-studio-suggest">
            {notSelected.map((item) => (
              <li key={item.legacy_trainer_id}>
                <button type="button" onClick={() => add(item)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="ma-sblock__avatar ma-sblock__avatar--sm">
                    {item.avatar ? <img src={item.avatar} alt="" /> : <UserRound size={14} aria-hidden />}
                  </span>
                  <span style={{ display: "grid", gap: 2, textAlign: "start", minWidth: 0 }}>
                    <span>{item.name ?? t("مدرب بدون اسم", "Unnamed instructor")}</span>
                    <TrainerSubtitle detail={item} />
                  </span>
                  <span className="ma-muted" style={{ marginInlineStart: "auto", fontSize: 12 }}>
                    {t("إضافة", "Add")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <input
        className="ma-input"
        placeholder={t("ابحث عن مدرب لإضافته…", "Search an instructor to add…")}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {search.data?.items.length ? (
        <ul className="ma-studio-suggest">
          {search.data.items
            .filter((item) => !hasRef(item))
            .map((item) => (
              <li key={item.legacy_trainer_id}>
                <button
                  type="button"
                  onClick={() => add(item)}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <span className="ma-sblock__avatar ma-sblock__avatar--sm">
                    {item.avatar ? <img src={item.avatar} alt="" /> : <UserRound size={14} aria-hidden />}
                  </span>
                  <span style={{ display: "grid", gap: 2, textAlign: "start", minWidth: 0 }}>
                    <span>{item.name}</span>
                    <TrainerSubtitle detail={item} />
                  </span>
                </button>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

function TrainerSubtitle({ detail }: { detail: AdminInstructor }) {
  const t = useT();
  const specialization = detail.specialization?.trim();
  const years = yearsLabel(detail.years_of_experience);
  const parts = [
    specialization,
    years ? t(`${years} سنوات خبرة`, `${years} years of experience`) : null,
  ].filter(Boolean);
  if (parts.length === 0) {
    const bio = plainText(detail.bio);
    return (
      <small className="ma-muted">
        {detail.email ?? (bio ? `${bio.slice(0, 90)}${bio.length > 90 ? "…" : ""}` : t("لا توجد تفاصيل إضافية", "No extra details"))}
      </small>
    );
  }
  return <small className="ma-muted">{parts.join(" · ")}</small>;
}

function InstructorRow({
  item,
  detail,
  index,
  total,
  dragging,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  item: Instructor;
  detail?: AdminInstructor;
  index: number;
  total: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (event: React.DragEvent<HTMLLIElement>) => void;
  onDrop: () => void;
  onDragEnd: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const trainerId = legacyTrainerId(item.ref);
  // A trainer added from search may not be on the product yet; load their full card on demand.
  const fallback = useQuery({
    queryKey: ["learning", "studio", "instructor-detail", trainerId],
    queryFn: () => getAdminInstructor(trainerId as number),
    enabled: open && trainerId !== null && !detail,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const data = detail ?? fallback.data;
  const bio = plainText(data?.bio);
  const subtitle = data ? detailsLine(data) : null;

  return (
    <li
      className={dragging ? "is-dragging" : undefined}
      style={{ flexWrap: "wrap" }}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <GripVertical size={14} aria-hidden className="ma-studio-list__grip" />
      <span className="ma-sblock__avatar ma-sblock__avatar--sm">
        {item.avatar_url ? <img src={item.avatar_url} alt="" /> : <UserRound size={14} aria-hidden />}
      </span>
      <span className="ma-studio-list__name">
        <span style={{ display: "block" }}>{item.display_name}</span>
        {subtitle ? (
          <small className="ma-muted" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </small>
        ) : null}
      </span>
      <button
        type="button"
        aria-label={open ? t("إخفاء التفاصيل", "Hide details") : t("عرض التفاصيل", "Show details")}
        title={open ? t("إخفاء التفاصيل", "Hide details") : t("عرض التفاصيل", "Show details")}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <ChevronUp size={14} aria-hidden /> : <Info size={14} aria-hidden />}
      </button>
      <button type="button" aria-label={t("لأعلى", "Move up")} disabled={index === 0} onClick={onMoveUp}>
        <ArrowUp size={14} aria-hidden />
      </button>
      <button type="button" aria-label={t("لأسفل", "Move down")} disabled={index === total - 1} onClick={onMoveDown}>
        <ArrowDown size={14} aria-hidden />
      </button>
      <button type="button" aria-label={t("إزالة", "Remove")} onClick={onRemove}>
        <X size={14} aria-hidden />
      </button>

      {open ? (
        <div
          style={{
            flexBasis: "100%",
            display: "grid",
            gap: 8,
            paddingBlockStart: 8,
            borderBlockStart: "1px solid var(--line)",
          }}
        >
          {fallback.isLoading && !data ? (
            <span className="ma-muted" style={{ fontSize: 12 }}>
              {t("جارٍ تحميل تفاصيل المدرب…", "Loading trainer details…")}
            </span>
          ) : null}
          {!fallback.isLoading && !data ? (
            <span className="ma-muted" style={{ fontSize: 12 }}>
              {t("لا توجد تفاصيل إضافية لهذا المدرب.", "No extra details for this trainer.")}
            </span>
          ) : null}
          {data ? (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: 6,
                  fontSize: 12,
                }}
              >
                <DetailItem icon={<Mail size={13} aria-hidden />} label={t("البريد", "Email")} value={data.email} />
                <DetailItem icon={<Phone size={13} aria-hidden />} label={t("الهاتف", "Phone")} value={data.phone} />
                <DetailItem icon={<MapPin size={13} aria-hidden />} label={t("المدينة", "City")} value={data.city} />
                <DetailItem icon={<MapPin size={13} aria-hidden />} label={t("الجنسية", "Nationality")} value={data.nationality} />
                <DetailItem
                  icon={<Info size={13} aria-hidden />}
                  label={t("التخصص", "Specialization")}
                  value={data.specialization}
                />
                <DetailItem
                  icon={<Info size={13} aria-hidden />}
                  label={t("سنوات الخبرة", "Years of experience")}
                  value={yearsLabel(data.years_of_experience)}
                />
              </div>
              {bio ? (
                <p
                  className="ma-muted"
                  style={{
                    margin: 0,
                    fontSize: 12,
                    lineHeight: 1.8,
                    maxHeight: 180,
                    overflow: "auto",
                  }}
                >
                  {bio}
                </p>
              ) : (
                <span className="ma-muted" style={{ fontSize: 12 }}>
                  {t("لا توجد نبذة مكتوبة.", "No bio written.")}
                </span>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value?.trim()) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--text-muted)" }}>
      {icon}
      <strong style={{ fontWeight: 600, color: "var(--text)" }}>{label}:</strong>
      <span>{value}</span>
    </span>
  );
}

function detailsLine(detail: AdminInstructor): string | null {
  const years = yearsLabel(detail.years_of_experience);
  const contact = detail.email ?? detail.phone ?? null;
  const parts = [detail.specialization, years ? `${years}` : null, contact].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  const bio = plainText(detail.bio);
  return bio ? `${bio.slice(0, 90)}${bio.length > 90 ? "…" : ""}` : null;
}

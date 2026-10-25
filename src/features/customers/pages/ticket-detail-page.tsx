import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Headset,
  History,
  ImageIcon,
  Loader2,
  Lock,
  Paperclip,
  Send,
  User,
  X,
} from "lucide-react";

import {
  addB2CSupportInternalNote,
  assignB2CSupportTicket,
  b2cTicketsKeys,
  getAdminSupportAttachmentDownloadUrl,
  getB2CSupportTicket,
  getB2CSupportTicketCustomer,
  listB2CSupportTicketActivities,
  listSupportAgents,
  replyB2CSupportTicket,
  resolveB2CSupportTicket,
  updateB2CSupportTicket,
  uploadAdminSupportAttachment,
  type B2CTicketAttachment,
} from "@/lib/api";
import { useAdminAuth } from "@/lib/auth/store";
import { formatDate, formatDateTime } from "@/lib/format";
import { useT } from "@/lib/i18n";
import {
  Avatar,
  Badge,
  Button,
  Empty,
  ErrorAlert,
  Field,
  IconButton,
  Loading,
  PageHead,
} from "@/components/ui/kit";
import { SelectField } from "@/components/ui/select";
import { PageState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { AppLink } from "@/components/ui/app-link";

export const b2cStatusDef = (status: string) => {
  switch (status?.toLowerCase()) {
    case "new":
      return { label: { ar: "جديدة", en: "New" }, tone: "warning" as const };
    case "open":
      return { label: { ar: "مفتوحة", en: "Open" }, tone: "info" as const };
    case "in_progress":
      return { label: { ar: "قيد المتابعة", en: "In Progress" }, tone: "info" as const };
    case "waiting_customer":
    case "waiting_for_customer":
      return { label: { ar: "بانتظار العميل", en: "Waiting Customer" }, tone: "neutral" as const };
    case "on_hold":
      return { label: { ar: "معلقة", en: "On Hold" }, tone: "warning" as const };
    case "resolved":
      return { label: { ar: "تم الحل", en: "Resolved" }, tone: "success" as const };
    case "closed":
      return { label: { ar: "مغلقة", en: "Closed" }, tone: "neutral" as const };
    default:
      return { label: { ar: status || "غير معروف", en: status || "Unknown" }, tone: "neutral" as const };
  }
};

export const b2cPriorityDef = (priority: string) => {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return { label: { ar: "حرجة جداً", en: "Urgent" }, tone: "danger" as const };
    case "high":
      return { label: { ar: "عالية", en: "High" }, tone: "warning" as const };
    case "medium":
      return { label: { ar: "متوسطة", en: "Medium" }, tone: "info" as const };
    case "low":
      return { label: { ar: "منخفضة", en: "Low" }, tone: "neutral" as const };
    default:
      return { label: { ar: priority || "عادية", en: priority || "Normal" }, tone: "neutral" as const };
  }
};

type ResolutionType =
  | "SOLVED"
  | "WORKAROUND"
  | "COURSE_ACCESS_RESTORED"
  | "REFUND_PROCESSED"
  | "DUPLICATE"
  | "NOT_REPRODUCIBLE"
  | "OTHER";

type Side = "customer" | "agent" | "note";
type ThreadRow =
  | { type: "day"; key: string; label: string }
  | { type: "msg"; key: string; side: Side; name: string; body: string; at: string; newGroup: boolean; attachments?: B2CTicketAttachment[] };

const timeFmt = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });
const formatTime = (iso: string) => timeFmt.format(new Date(iso));

export default function TicketDetailPage() {
  const t = useT();
  const { ticketId = "" } = useParams<{ ticketId: string }>();
  const currentAdmin = useAdminAuth((s) => s.admin);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resolution modal state
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);

  // Composer State
  const [composerMode, setComposerMode] = useState<"reply" | "note">("reply");
  const [composerText, setComposerText] = useState("");
  const [pendingAttachment, setPendingAttachment] = useState<B2CTicketAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Queries
  const ticketQuery = useQuery({
    queryKey: b2cTicketsKeys.detail(ticketId),
    queryFn: () => getB2CSupportTicket(ticketId),
    enabled: Boolean(ticketId),
  });

  const customerQuery = useQuery({
    queryKey: b2cTicketsKeys.customer(ticketId),
    queryFn: () => getB2CSupportTicketCustomer(ticketId),
    enabled: Boolean(ticketId),
  });

  const activityQuery = useQuery({
    queryKey: b2cTicketsKeys.activity(ticketId),
    queryFn: () => listB2CSupportTicketActivities(ticketId),
    enabled: Boolean(ticketId),
  });

  const agentsQuery = useQuery({
    queryKey: b2cTicketsKeys.agents(),
    queryFn: listSupportAgents,
  });

  const ticketData = ticketQuery.data;
  const ticketInfo = ticketData?.ticket;
  const customer = customerQuery.data;
  const activities = activityQuery.data ?? [];
  const agents = agentsQuery.data ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: b2cTicketsKeys.detail(ticketId) });
    queryClient.invalidateQueries({ queryKey: b2cTicketsKeys.activity(ticketId) });
    queryClient.invalidateQueries({ queryKey: b2cTicketsKeys.all });
  };

  // Mutations
  const updateMutation = useMutation({
    mutationFn: (data: { status?: string; priority?: string }) => updateB2CSupportTicket(ticketId, data),
    onSuccess: invalidate,
  });

  const assignMutation = useMutation({
    mutationFn: (assigned_admin_id: string) => assignB2CSupportTicket(ticketId, { assigned_admin_id }),
    onSuccess: invalidate,
  });

  const replyMutation = useMutation({
    mutationFn: () =>
      replyB2CSupportTicket(ticketId, {
        body: composerText,
        status_after: "WAITING_FOR_CUSTOMER",
        attachment_ids: pendingAttachment ? [pendingAttachment.attachment_id] : undefined,
      }),
    onSuccess: () => {
      setComposerText("");
      setPendingAttachment(null);
      invalidate();
    },
  });

  const noteMutation = useMutation({
    mutationFn: () =>
      addB2CSupportInternalNote(ticketId, {
        body: composerText,
        attachment_ids: pendingAttachment ? [pendingAttachment.attachment_id] : undefined,
      }),
    onSuccess: () => {
      setComposerText("");
      setPendingAttachment(null);
      invalidate();
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const att = await uploadAdminSupportAttachment(file, ticketId);
      setPendingAttachment(att);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "فشل رفع الملف إلى التخزين.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Lightbox preview state for images and documents
  const [previewAttachment, setPreviewAttachment] = useState<{
    id: string;
    url: string;
    filename: string;
    contentType?: string;
  } | null>(null);
  const [loadingAttachmentId, setLoadingAttachmentId] = useState<string | null>(null);

  const handleOpenAttachment = async (att: {
    attachment_id: string;
    original_filename: string;
    content_type?: string;
  }) => {
    setLoadingAttachmentId(att.attachment_id);
    try {
      const res = await getAdminSupportAttachmentDownloadUrl(att.attachment_id);
      if (!res.download_url) {
        alert(t("تعذر تحميل المرفق.", "Failed to download attachment."));
        return;
      }
      const isImage =
        (att.content_type || "").startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|svg)$/i.test(att.original_filename);

      if (isImage) {
        setPreviewAttachment({
          id: att.attachment_id,
          url: res.download_url,
          filename: att.original_filename,
          contentType: att.content_type || "image/png",
        });
      } else {
        window.open(res.download_url, "_blank", "noopener,noreferrer");
      }
    } catch {
      alert(t("تعذر تحميل المرفق.", "Failed to download attachment."));
    } finally {
      setLoadingAttachmentId(null);
    }
  };

  // Auto-grow the composer.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [composerText]);

  // Flatten the ticket into a chronological chat thread (initial inquiry + replies).
  const thread = useMemo<ThreadRow[]>(() => {
    if (!ticketData || !ticketInfo) return [];

    type Src = { at: string; side: Side; name: string; body: string; attachments?: B2CTicketAttachment[] };
    const src: Src[] = [];
    src.push({
      at: ticketInfo.created_at,
      side: "customer",
      name: ticketInfo.customer_name || t("العميل", "Customer"),
      body: ticketData.description,
      attachments: ticketData.initial_attachments,
    });
    for (const m of ticketData.messages ?? []) {
      const isInternal = m.visibility === "internal";
      const isAdmin = m.sender_type === "ADMIN";
      src.push({
        at: m.created_at,
        side: isInternal ? "note" : isAdmin ? "agent" : "customer",
        name: m.sender_name || (isAdmin ? t("الدعم الفني", "Support Staff") : t("العميل", "Customer")),
        body: m.body,
        attachments: m.attachments,
      });
    }
    src.sort((a, b) => a.at.localeCompare(b.at));

    const rows: ThreadRow[] = [];
    let prevDay = "";
    let prevKey = "";
    src.forEach((s, index) => {
      const day = s.at.slice(0, 10);
      if (day !== prevDay) {
        rows.push({ type: "day", key: `day-${day}`, label: dayLabel(s.at, t) });
        prevDay = day;
        prevKey = "";
      }
      const gk = `${s.side}:${s.name}`;
      rows.push({
        type: "msg",
        key: `${index}-${s.at}-${s.side}`,
        side: s.side,
        name: s.name,
        body: s.body,
        at: s.at,
        newGroup: gk !== prevKey,
        attachments: s.attachments,
      });
      prevKey = gk;
    });
    return rows;
  }, [ticketData, ticketInfo, t]);

  const canResolve = ticketInfo && ticketInfo.status !== "resolved" && ticketInfo.status !== "closed";
  const canReopen = ticketInfo && (ticketInfo.status === "resolved" || ticketInfo.status === "closed");
  const composerSending = replyMutation.isPending || noteMutation.isPending;

  const submit = () => {
    if (!composerText.trim()) return;
    if (composerMode === "reply") replyMutation.mutate();
    else noteMutation.mutate();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHead
        title={ticketInfo ? `#${ticketInfo.ticket_number} - ${ticketInfo.subject}` : t("تفاصيل تذكرة الدعم", "Support Ticket Detail")}
        back={{ href: "/customers/tickets", label: t("التذاكر", "Tickets") }}
        actions={
          canResolve ? (
            <Button
              sm
              kind="primary"
              icon="check"
              label={t("حل وإغلاق التذكرة", "Resolve Ticket")}
              onClick={() => setResolveDialogOpen(true)}
            />
          ) : canReopen ? (
            <Button
              sm
              kind="secondary"
              icon="refresh"
              label={t("إعادة الفتح", "Reopen Ticket")}
              disabled={updateMutation.isPending}
              onClick={() => updateMutation.mutate({ status: "open" })}
            />
          ) : null
        }
      />

      <PageState error={ticketQuery.error}>
        {ticketData && ticketInfo ? (
          <div className="ma-chat-grid">
            {/* Conversation console */}
            <div className="ma-panel ma-panel--flush ma-chat">
              {/* Chat header */}
              <header className="ma-chat__head">
                <div className="ma-chat__who">
                  <div className="flex items-center gap-2">
                    <span className="ma-chat__id">#{ticketInfo.ticket_number}</span>
                    <h2 className="ma-chat__subject">{ticketInfo.subject}</h2>
                  </div>
                  <div className="ma-chat__contact">
                    <span className="font-semibold text-foreground">{ticketInfo.customer_name}</span>
                    <span className="ma-dot">•</span>
                    <span>{ticketInfo.customer_email}</span>
                    <span className="ma-dot">•</span>
                    <span>{formatDateTime(ticketInfo.created_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge def={b2cStatusDef(ticketInfo.status)} />
                  <Badge def={b2cPriorityDef(ticketInfo.priority)} />
                </div>
              </header>

              {/* SLA strip */}
              <div className="ma-chat__meta">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-3.5" />
                  <span>{t("أول استجابة:", "First response:")}</span>
                  <b>
                    {ticketInfo.first_response_at
                      ? `✓ ${formatTime(ticketInfo.first_response_at)}`
                      : ticketInfo.sla_response_due_at
                        ? formatDateTime(ticketInfo.sla_response_due_at)
                        : "—"}
                  </b>
                </span>
                {ticketInfo.category_name_ar ? (
                  <span>{t(ticketInfo.category_name_ar, ticketInfo.category_name_en)}</span>
                ) : null}
                {ticketInfo.assigned_admin_name ? (
                  <span className="inline-flex items-center gap-1">
                    <Headset className="size-3.5" />
                    <span>{ticketInfo.assigned_admin_name}</span>
                  </span>
                ) : null}
                {ticketInfo.sla_breached ? (
                  <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-bold">
                    <AlertCircle className="size-3.5" />
                    <span>{t("تجاوز SLA", "SLA Breached")}</span>
                  </span>
                ) : (
                  <span className="ma-badge ma-badge--success">{t("ضمن SLA", "Within SLA")}</span>
                )}
              </div>

              {/* Resolved banner */}
              {canReopen ? (
                <div className="ma-chat__banner">
                  <span>{t("تم حل هذه التذكرة وإغلاقها.", "This ticket has been resolved and closed.")}</span>
                  <Button sm kind="ghost" icon="refresh" label={t("إعادة الفتح", "Reopen")} disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ status: "open" })} />
                </div>
              ) : null}

              {/* Thread */}
              <div className="ma-chat__thread">
                {thread.length === 0 ? (
                  <Empty icon="message" text={t("لا توجد رسائل في هذه التذكرة بعد.", "No messages in this ticket yet.")} />
                ) : (
                  thread.map((row) => {
                    if (row.type === "day") {
                      return (
                        <div key={row.key} className="ma-chat__day">
                          {row.label}
                        </div>
                      );
                    }
                    const isLatin = !/[\u0600-\u06FF]/.test(row.body);
                    return (
                      <div key={row.key} className={`ma-chat__msg ma-chat__msg--${row.side}${row.newGroup ? " is-new-group" : ""}`}>
                        <BubbleAvatar side={row.side} />
                        <div className="ma-chat__col">
                          {row.side === "note" ? (
                            <span className="ma-chat__note-label">
                              <Lock className="size-3" />
                              <span>{t("ملاحظة داخلية", "Internal note")}</span>
                            </span>
                          ) : null}
                          <div className="ma-chat__meta-line">
                            <span className="ma-chat__sender">{row.name}</span>
                            <span className="ma-num">{formatTime(row.at)}</span>
                          </div>
                          <div className="ma-chat__bubble" lang={isLatin ? "en" : undefined}>
                            {row.body}
                          </div>
                          {row.attachments && row.attachments.length > 0 ? (
                            <div className="ma-chat__atts">
                              {row.attachments.map((att) => (
                                <ChatAttachment
                                  key={att.attachment_id}
                                  attachment={att}
                                  onOpen={() => handleOpenAttachment(att)}
                                  loading={loadingAttachmentId === att.attachment_id}
                                />
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Composer */}
              <div className={`ma-composer${composerMode === "note" ? " is-note" : ""}`}>
                <div className="ma-composer__modes" role="tablist">
                  <button type="button" role="tab" aria-selected={composerMode === "reply"} aria-pressed={composerMode === "reply"} onClick={() => setComposerMode("reply")}>
                    <Send className="size-3.5" />
                    <span>{t("رد رسمي للمستفيد", "Public Reply")}</span>
                  </button>
                  <button type="button" role="tab" aria-selected={composerMode === "note"} aria-pressed={composerMode === "note"} onClick={() => setComposerMode("note")}>
                    <Lock className="size-3.5" />
                    <span>{t("ملاحظة داخلية", "Internal Note")}</span>
                  </button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit();
                  }}
                >
                  <div className="ma-composer__body">
                    <textarea
                      ref={composerRef}
                      rows={1}
                      value={composerText}
                      onChange={(e) => setComposerText(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                          e.preventDefault();
                          submit();
                        }
                      }}
                      placeholder={
                        composerMode === "reply"
                          ? t("اكتب ردك الواضح للمستفيد هنا… (اضغط Enter للإرسال)", "Write a reply to the customer… (Enter to send)")
                          : t("اكتب ملاحظة تشخيصية داخلية للفريق… (لا يراها المستفيد)", "Write an internal note for the team… (hidden from customer)")
                      }
                    />
                  </div>

                  {pendingAttachment ? (
                    <div className="ma-composer__pending">
                      <div className="ma-composer__pending__item">
                        <Paperclip className="size-3.5" />
                        <span>{pendingAttachment.original_filename}</span>
                        <button type="button" aria-label={t("إزالة المرفق", "Remove attachment")} onClick={() => setPendingAttachment(null)}>
                          <X className="size-3" />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {uploadError ? <p className="ma-composer__hint" style={{ color: "var(--danger)", margin: "0 var(--space-6) var(--space-2)" }}>{uploadError}</p> : null}
                  {replyMutation.error ? <ErrorAlert error={replyMutation.error} /> : null}
                  {noteMutation.error ? <ErrorAlert error={noteMutation.error} /> : null}

                  <div className="ma-composer__bar">
                    <input
                      ref={fileInputRef}
                      type="file"
                      id="b2c-attachment-input-detail"
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.zip,.txt"
                      onChange={handleFileUpload}
                    />
                    <button
                      type="button"
                      disabled={uploading || composerSending}
                      onClick={() => fileInputRef.current?.click()}
                      className="ma-btn ma-btn--soft ma-btn--sm"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>{t("جارٍ الرفع…", "Uploading…")}</span>
                        </>
                      ) : (
                        <>
                          <Paperclip className="size-4" />
                          <span>{t("إرفاق ملف", "Attach")}</span>
                        </>
                      )}
                    </button>
                    <span className="ma-composer__hint">{t("Enter للإرسال · Shift+Enter لسطر جديد", "Enter to send · Shift+Enter for a new line")}</span>
                    <Button
                      type="submit"
                      kind={composerMode === "reply" ? "secondary" : "soft"}
                      icon="send"
                      iconEnd
                      disabled={!composerText.trim() || uploading || composerSending}
                      label={
                        composerSending
                          ? t("جارٍ الإرسال…", "Sending…")
                          : composerMode === "reply"
                            ? t("إرسال الرد", "Send reply")
                            : t("حفظ الملاحظة", "Save note")
                      }
                    />
                  </div>
                </form>
              </div>
            </div>

            {/* Details sidebar */}
            <aside className="ma-panel ma-panel--flush ma-info">
              {/* Triage & assignment */}
              <section className="ma-info__sec">
                <h3><Headset className="size-3.5" /><span>{t("توجيه وإسناد التذكرة", "Triage & Assignment")}</span></h3>
                <div className="ma-form" style={{ gap: "var(--space-3)" }}>
                  <div>
                    <label className="ma-label">{t("الموظف المسؤول", "Assigned Agent")}</label>
                    <div className="flex items-center gap-2">
                      <SelectField
                        label={t("تعيين موظف", "Assign agent")}
                        value={ticketInfo.assigned_admin_id ?? "unassigned"}
                        onChange={(val) => {
                          if (val !== "unassigned") assignMutation.mutate(val);
                        }}
                        options={[
                          { value: "unassigned", label: t("— غير معينة —", "— Unassigned —") },
                          ...agents.map((ag) => ({
                            value: ag.admin_user_id,
                            label: `${ag.full_name || ag.email} (${ag.email})`,
                          })),
                        ]}
                        className="w-full"
                      />
                      {currentAdmin?.admin_user_id && ticketInfo.assigned_admin_id !== currentAdmin.admin_user_id ? (
                        <Button sm label={t("لي", "Me")} disabled={assignMutation.isPending} onClick={() => assignMutation.mutate(currentAdmin.admin_user_id)} />
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label className="ma-label">{t("الأولوية", "Priority")}</label>
                    <SelectField
                      label={t("تعديل الأولوية", "Change priority")}
                      value={ticketInfo.priority}
                      onChange={(val) => updateMutation.mutate({ priority: val })}
                      options={[
                        { value: "urgent", label: t("حرجة للغاية", "Urgent") },
                        { value: "high", label: t("عالية", "High") },
                        { value: "medium", label: t("متوسطة", "Medium") },
                        { value: "low", label: t("منخفضة", "Low") },
                      ]}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="ma-label">{t("الحالة", "Status")}</label>
                    <SelectField
                      label={t("تعديل الحالة", "Change status")}
                      value={ticketInfo.status}
                      onChange={(val) => updateMutation.mutate({ status: val })}
                      options={[
                        { value: "new", label: t("جديدة", "New") },
                        { value: "open", label: t("مفتوحة", "Open") },
                        { value: "in_progress", label: t("قيد المتابعة", "In Progress") },
                        { value: "waiting_customer", label: t("بانتظار العميل", "Waiting Customer") },
                        { value: "resolved", label: t("تم الحل", "Resolved") },
                        { value: "closed", label: t("مغلقة", "Closed") },
                      ]}
                      className="w-full"
                    />
                  </div>
                </div>
              </section>

              {/* Customer 360 */}
              <section className="ma-info__sec">
                <h3><User className="size-3.5" /><span>{t("بطاقة العميل", "Customer 360")}</span></h3>
                {customer ? (
                  <div className="flex flex-col gap-3">
                    <div className="ma-info__profile">
                      <Avatar initials={(customer.full_name || "C").slice(0, 2).toUpperCase()} />
                      <div className="min-w-0">
                        <div className="ma-info__name">{customer.full_name || t("بدون اسم", "Unnamed")}</div>
                        <CopyRow icon="mail" value={customer.email} />
                        {customer.phone ? <CopyRow icon="phone" value={customer.phone} /> : null}
                      </div>
                    </div>
                    <div className="ma-info__stats">
                      <div className="ma-info__stat"><b>{customer.total_tickets}</b><span>{t("إجمالي التذاكر", "Total Tickets")}</span></div>
                      <div className="ma-info__stat"><b>{customer.open_tickets}</b><span>{t("مفتوحة", "Open")}</span></div>
                      <div className="ma-info__stat"><b>{customer.orders?.length ?? 0}</b><span>{t("طلبات", "Orders")}</span></div>
                      <div className="ma-info__stat"><b>{customer.subscriptions?.length ?? 0}</b><span>{t("اشتراكات", "Subscriptions")}</span></div>
                    </div>
                    <AppLink to={`/customers/${ticketInfo.customer_id}`} className="ma-link text-xs font-semibold inline-flex items-center gap-1">
                      <span>{t("الملف الكامل", "Full Profile")}</span>
                      <ExternalLink className="size-3" />
                    </AppLink>
                  </div>
                ) : (
                  <Loading />
                )}
              </section>

              {/* Ticket info */}
              <section className="ma-info__sec">
                <h3><Clock className="size-3.5" /><span>{t("معلومات التذكرة", "Ticket Details")}</span></h3>
                <dl className="ma-info__dl">
                  <div><dt>{t("فُتحت", "Opened")}</dt><dd>{formatDate(ticketInfo.created_at)}</dd></div>
                  <div><dt>{t("التصنيف", "Category")}</dt><dd>{t(ticketInfo.category_name_ar, ticketInfo.category_name_en)}</dd></div>
                  {ticketInfo.related_entity_label ? (
                    <div><dt>{t("المنتج المرتبط", "Related")}</dt><dd>{ticketInfo.related_entity_label}</dd></div>
                  ) : null}
                  <div><dt>{t("مهلة الرد", "Response SLA")}</dt><dd>{formatDateTime(ticketInfo.sla_response_due_at)}</dd></div>
                  <div><dt>{t("مهلة الحل", "Resolution SLA")}</dt><dd>{formatDateTime(ticketInfo.sla_resolution_due_at)}</dd></div>
                </dl>
              </section>

              {/* Activity timeline */}
              <section className="ma-info__sec">
                <h3><History className="size-3.5" /><span>{t("سجل النشاط", "Audit Timeline")}</span></h3>
                {activities.length > 0 ? (
                  <ul className="ma-info__timeline">
                    {activities.map((act) => (
                      <li key={act.activity_id}>
                        <span className="font-semibold">{act.actor_name || t("النظام", "System")}</span>
                        <span className="text-muted-foreground"> • {act.action}</span>
                        <time>{formatDateTime(act.created_at)}</time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-xs text-muted-foreground">{t("لا أنشطة مسجلة بعد.", "No activities yet.")}</span>
                )}
              </section>
            </aside>
          </div>
        ) : (
          <Loading />
        )}
      </PageState>

      {/* Ticket Resolution Modal */}
      {resolveDialogOpen && ticketId ? (
        <ResolutionModal
          open={resolveDialogOpen}
          ticketId={ticketId}
          onClose={() => setResolveDialogOpen(false)}
        />
      ) : null}

      {/* Attachment Lightbox Modal */}
      {previewAttachment ? (
        <AttachmentLightboxModal
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
        />
      ) : null}
    </div>
  );
}

// ==========================================
// Helpers
// ==========================================

function dayLabel(iso: string, t: (ar: string, en?: string) => string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return t("اليوم", "Today");
  if (d.toDateString() === yesterday.toDateString()) return t("أمس", "Yesterday");
  return formatDate(iso);
}

function BubbleAvatar({ side }: { side: Side }) {
  if (side === "note") {
    return (
      <span className="ma-avatar ma-chat__avatar" style={{ background: "var(--yellow)", color: "var(--ink)" }}>
        <Lock className="size-4" />
      </span>
    );
  }
  if (side === "agent") {
    return (
      <span className="ma-avatar ma-chat__avatar" style={{ background: "var(--text)", color: "var(--surface)" }}>
        <Headset className="size-4" />
      </span>
    );
  }
  return (
    <span className="ma-avatar ma-chat__avatar" style={{ background: "var(--surface-alt)", color: "var(--text)" }}>
      <User className="size-4" />
    </span>
  );
}

function CopyRow({ icon, value }: { icon: "mail" | "phone"; value: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="ma-info__contact">
      {icon === "mail" ? <span className="text-muted-foreground text-xs" style={{ direction: "ltr" }}>{value}</span> : <span>{value}</span>}
      <button type="button" className="ma-info__copy" aria-label={t("نسخ", "Copy")} onClick={copy}>
        {copied ? <CheckGlyph /> : <CopyGlyph />}
      </button>
    </div>
  );
}

function CopyGlyph() {
  return (
    <svg className="ma-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter">
      <rect x="8" y="8" width="13" height="13" rx="2" />
      <path d="M16 8V4H3v13h5" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg className="ma-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" strokeLinejoin="miter">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

// ==========================================
// Chat attachment chip
// ==========================================

function ChatAttachment({
  attachment,
  onOpen,
  loading = false,
}: {
  attachment: { attachment_id: string; original_filename: string; content_type?: string; size_bytes?: number };
  onOpen: () => void;
  loading?: boolean;
}) {
  const isImage =
    (attachment.content_type || "").startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(attachment.original_filename);

  return (
    <button type="button" onClick={onOpen} disabled={loading} className="ma-chat__att" title={attachment.original_filename}>
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : isImage ? (
        <ImageIcon className="size-4" />
      ) : (
        <FileText className="size-4" />
      )}
      <span className="ma-chat__att__name">{attachment.original_filename}</span>
      {attachment.size_bytes ? (
        <span className="ma-chat__att__size">{(attachment.size_bytes / 1024).toFixed(1)} KB</span>
      ) : null}
    </button>
  );
}

// ==========================================
// Ticket Resolution Modal
// ==========================================

function ResolutionModal({
  open,
  ticketId,
  onClose,
}: {
  open: boolean;
  ticketId: string;
  onClose: () => void;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const [resolutionType, setResolutionType] = useState<ResolutionType>("SOLVED");
  const [summary, setSummary] = useState("");

  const resolveMutation = useMutation({
    mutationFn: () =>
      resolveB2CSupportTicket(ticketId, {
        resolution_type: resolutionType,
        resolution_summary: summary,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: b2cTicketsKeys.detail(ticketId) });
      queryClient.invalidateQueries({ queryKey: b2cTicketsKeys.all });
      onClose();
    },
  });

  return (
    <Modal
      open={open}
      onOpenChange={(isOpen) => !isOpen && onClose()}
      title={t("حل تذكرة الدعم وإغلاقها", "Resolve & Close Ticket")}
      description={t(
        "سجل نوع الحل وملخص الإجراء المتخذ لإغلاق التذكرة وإشعار المستفيد بذلك عبر البريد.",
        "Record the resolution type and summary to close this ticket and notify the customer.",
      )}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button label={t("إلغاء", "Cancel")} onClick={onClose} disabled={resolveMutation.isPending} />
          <Button
            kind="primary"
            icon="check"
            label={resolveMutation.isPending ? t("جارٍ الحفظ…", "Saving…") : t("تأكيد حل التذكرة", "Confirm Resolution")}
            disabled={!summary.trim() || resolveMutation.isPending}
            onClick={() => resolveMutation.mutate()}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-4 py-2">
        <div>
          <label className="ma-label">{t("نوع الحل", "Resolution Type")}</label>
          <SelectField<ResolutionType>
            label={t("نوع الحل", "Resolution type")}
            value={resolutionType}
            onChange={setResolutionType}
            options={[
              { value: "SOLVED", label: t("تم الحل بنجاح", "Solved") },
              { value: "WORKAROUND", label: t("حل بديل", "Workaround") },
              { value: "COURSE_ACCESS_RESTORED", label: t("استعادة صلاحية الدورة", "Access Restored") },
              { value: "REFUND_PROCESSED", label: t("استرداد مالي", "Refund Processed") },
              { value: "DUPLICATE", label: t("تذكرة مكررة", "Duplicate") },
              { value: "NOT_REPRODUCIBLE", label: t("تعذر تكرار المشكلة", "Not Reproducible") },
              { value: "OTHER", label: t("أخرى", "Other") },
            ]}
            className="w-full"
          />
        </div>

        <Field
          id="resolution-summary"
          type="textarea"
          rows={3}
          label={t("ملخص الإجراء والحل المتخذ (إلزامي)", "Resolution Summary (Required)")}
          value={summary}
          onChange={setSummary}
          placeholder={t("اكتب الإجراءات التي تمت لحل مشكلة العميل…", "Describe what was done to resolve the customer issue…")}
        />

        {resolveMutation.error ? <ErrorAlert error={resolveMutation.error} /> : null}
      </div>
    </Modal>
  );
}

// ==========================================
// Attachment Lightbox Modal
// ==========================================

function AttachmentLightboxModal({
  attachment,
  onClose,
}: {
  attachment: { id: string; url: string; filename: string; contentType?: string };
  onClose: () => void;
}) {
  const t = useT();
  const isImage =
    (attachment.contentType || "").startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(attachment.filename);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col max-w-4xl w-full max-h-[90vh] rounded-2xl bg-surface border border-line overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4 p-4 border-b border-line">
          <div className="flex items-center gap-2.5 min-w-0">
            {isImage ? (
              <ImageIcon className="size-5 text-accent shrink-0" />
            ) : (
              <FileText className="size-5 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-bold truncate" dir="ltr">{attachment.filename}</span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              download={attachment.filename}
              className="ma-btn ma-btn--soft ma-btn--sm no-underline"
            >
              <Download className="size-4" />
              <span>{t("تحميل", "Download")}</span>
            </a>
            <IconButton icon="x" label="إغلاق" onClick={onClose} />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-6 grid place-items-center bg-black/5 dark:bg-black/30 min-h-[300px]">
          {isImage ? (
            <img
              src={attachment.url}
              alt={attachment.filename}
              className="max-h-[70vh] max-w-full object-contain rounded-lg border border-line/40"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
              <FileText className="size-12 text-accent" />
              <span className="font-bold text-sm" dir="ltr">{attachment.filename}</span>
              <a
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ma-btn ma-btn--primary ma-btn--sm"
              >
                <Download className="size-4" />
                <span>{t("تحميل واستعراض الملف", "Download file")}</span>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

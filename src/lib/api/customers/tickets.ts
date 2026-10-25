import { queryOptions } from "@tanstack/react-query";

import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

// ==========================================
// Legacy Tickets (Archive)
// ==========================================

type ListTicketsOp = "list_tickets_api_v1_admin_support_tickets_get";
type GetTicketOp = "get_ticket_api_v1_admin_support_tickets__legacy_ticket_id__get";
type SetTicketStatusOp = "set_ticket_status_api_v1_admin_support_tickets__legacy_ticket_id__status_post";
type ReplyTicketOp = "reply_ticket_api_v1_admin_support_tickets__legacy_ticket_id__replies_post";

export type SupportTicketsParams = QueryParams<ListTicketsOp>;
export type SupportTicketPage = SuccessResponse<ListTicketsOp>;
export type SupportTicketDetail = SuccessResponse<GetTicketOp>;
export type TicketStatusRequest = RequestBody<SetTicketStatusOp>;
export type TicketReplyRequest = RequestBody<ReplyTicketOp>;

export const ticketsPaths = {
  tickets: "admin/support/tickets",
  ticket: "admin/support/tickets/{legacy_ticket_id}",
  ticketStatus: "admin/support/tickets/{legacy_ticket_id}/status",
  ticketReplies: "admin/support/tickets/{legacy_ticket_id}/replies",
} as const;

export const ticketsKeys = {
  all: ["support", "tickets"] as const,
  list: (params?: SupportTicketsParams) => [...ticketsKeys.all, "list", params ?? {}] as const,
  detail: (legacyTicketId: number) => [...ticketsKeys.all, "detail", legacyTicketId] as const,
};

export function listSupportTickets(params: SupportTicketsParams = {}): Promise<SupportTicketPage> {
  return apiGet(ticketsPaths.tickets, { query: params });
}

export function getSupportTicket(
  legacy_ticket_id: PathParams<GetTicketOp>["legacy_ticket_id"],
): Promise<SupportTicketDetail> {
  return apiGet(ticketsPaths.ticket, { path: { legacy_ticket_id } });
}

/** `POST /admin/support/tickets/{id}/status` — ticket status (1 open, 3 closed, …). Audited. */
export function setSupportTicketStatus(
  legacy_ticket_id: PathParams<SetTicketStatusOp>["legacy_ticket_id"],
  body: TicketStatusRequest,
): Promise<SupportTicketDetail> {
  return apiPost(ticketsPaths.ticketStatus, { path: { legacy_ticket_id }, body });
}

/** `POST /admin/support/tickets/{id}/replies` — posts a reply as the signed-in admin. Audited. */
export function replySupportTicket(
  legacy_ticket_id: PathParams<ReplyTicketOp>["legacy_ticket_id"],
  body: TicketReplyRequest,
): Promise<SupportTicketDetail> {
  return apiPost(ticketsPaths.ticketReplies, { path: { legacy_ticket_id }, body });
}

export const ticketsQueries = {
  list: (params?: SupportTicketsParams) =>
    queryOptions({ queryKey: ticketsKeys.list(params), queryFn: () => listSupportTickets(params) }),
  detail: (legacyTicketId: number) =>
    queryOptions({ queryKey: ticketsKeys.detail(legacyTicketId), queryFn: () => getSupportTicket(legacyTicketId) }),
};

// ==========================================
// Modern B2C Support Tickets
// ==========================================

type ListB2CTicketsOp = "list_b2c_tickets_api_v1_admin_support_b2c_tickets_get";
type GetB2CTicketOp = "get_b2c_ticket_api_v1_admin_support_b2c_tickets__ticket_id__get";
type UpdateB2CTicketOp = "update_b2c_ticket_api_v1_admin_support_b2c_tickets__ticket_id__patch";
type AssignB2CTicketOp = "assign_b2c_ticket_api_v1_admin_support_b2c_tickets__ticket_id__assign_post";
type ReplyB2CTicketOp = "reply_b2c_ticket_api_v1_admin_support_b2c_tickets__ticket_id__messages_post";
type AddInternalNoteOp = "add_internal_note_api_v1_admin_support_b2c_tickets__ticket_id__notes_post";
type ResolveB2CTicketOp = "resolve_b2c_ticket_api_v1_admin_support_b2c_tickets__ticket_id__resolve_post";
type ListTicketActivitiesOp = "list_ticket_activities_api_v1_admin_support_b2c_tickets__ticket_id__activity_get";
type GetTicketCustomerOp = "get_ticket_customer_api_v1_admin_support_b2c_tickets__ticket_id__customer_get";
type GetAnalyticsOp = "get_analytics_api_v1_admin_support_analytics_get";
type ListAgentsOp = "list_agents_api_v1_admin_support_agents_get";
type PresignAdminAttachmentOp = "presign_admin_attachment_api_v1_admin_support_attachments_presign_post";
type ConfirmAdminAttachmentOp = "confirm_admin_attachment_api_v1_admin_support_attachments__attachment_id__confirm_post";
type GetAdminAttachmentDownloadOp = "get_admin_attachment_download_api_v1_admin_support_attachments__attachment_id__download_get";

export type B2CTicketsParams = QueryParams<ListB2CTicketsOp>;
export type B2CTicketPage = SuccessResponse<ListB2CTicketsOp>;
export type B2CTicketSummary = B2CTicketPage["items"][number];
export type B2CTicketDetail = SuccessResponse<GetB2CTicketOp>;
export type B2CTicketMessage = NonNullable<B2CTicketDetail["messages"]>[number];
export type B2CTicketAttachment = SuccessResponse<ConfirmAdminAttachmentOp>;
export type B2CTicketActivity = SuccessResponse<ListTicketActivitiesOp>[number];
export type B2CCustomerContext = SuccessResponse<GetTicketCustomerOp>;
export type B2CSupportAnalytics = SuccessResponse<GetAnalyticsOp>;
export type SupportAgent = SuccessResponse<ListAgentsOp>[number];
export type B2CResolutionResponse = SuccessResponse<ResolveB2CTicketOp>;

export type SupportCategory = {
  category_id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  default_priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  display_order: number;
  is_active: boolean;
};

export type CreateSupportCategoryRequest = {
  code: string;
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
  description_en?: string | null;
  default_priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  display_order?: number;
  is_active?: boolean;
};

export const b2cTicketsPaths = {
  analytics: "admin/support/analytics",
  agents: "admin/support/agents",
  categories: "admin/support/categories",
  category: "admin/support/categories/{category_id}",
  tickets: "admin/support/b2c/tickets",
  ticket: "admin/support/b2c/tickets/{ticket_id}",
  assign: "admin/support/b2c/tickets/{ticket_id}/assign",
  reply: "admin/support/b2c/tickets/{ticket_id}/messages",
  notes: "admin/support/b2c/tickets/{ticket_id}/notes",
  resolve: "admin/support/b2c/tickets/{ticket_id}/resolve",
  activity: "admin/support/b2c/tickets/{ticket_id}/activity",
  customer: "admin/support/b2c/tickets/{ticket_id}/customer",
  presignAttachment: "admin/support/attachments/presign",
  confirmAttachment: "admin/support/attachments/{attachment_id}/confirm",
  downloadAttachment: "admin/support/attachments/{attachment_id}/download",
} as const;

export const b2cTicketsKeys = {
  all: ["admin", "support", "b2c"] as const,
  analytics: () => [...b2cTicketsKeys.all, "analytics"] as const,
  agents: () => [...b2cTicketsKeys.all, "agents"] as const,
  categories: () => [...b2cTicketsKeys.all, "categories"] as const,
  list: (params?: B2CTicketsParams) => [...b2cTicketsKeys.all, "list", params ?? {}] as const,
  detail: (ticketId: string) => [...b2cTicketsKeys.all, "detail", ticketId] as const,
  activity: (ticketId: string) => [...b2cTicketsKeys.all, "activity", ticketId] as const,
  customer: (ticketId: string) => [...b2cTicketsKeys.all, "customer", ticketId] as const,
};

export function listB2CSupportTickets(params: B2CTicketsParams = {}): Promise<B2CTicketPage> {
  return apiGet(b2cTicketsPaths.tickets, { query: params });
}

export function getB2CSupportTicket(ticketId: string): Promise<B2CTicketDetail> {
  return apiGet(b2cTicketsPaths.ticket, { path: { ticket_id: ticketId } });
}

export function updateB2CSupportTicket(
  ticketId: string,
  body: RequestBody<UpdateB2CTicketOp>,
): Promise<B2CTicketDetail> {
  return apiPatch(b2cTicketsPaths.ticket, { path: { ticket_id: ticketId }, body });
}

export function assignB2CSupportTicket(
  ticketId: string,
  body: RequestBody<AssignB2CTicketOp>,
): Promise<B2CTicketDetail> {
  return apiPost(b2cTicketsPaths.assign, { path: { ticket_id: ticketId }, body });
}

export function replyB2CSupportTicket(
  ticketId: string,
  body: RequestBody<ReplyB2CTicketOp>,
): Promise<B2CTicketMessage> {
  return apiPost(b2cTicketsPaths.reply, { path: { ticket_id: ticketId }, body });
}

export function addB2CSupportInternalNote(
  ticketId: string,
  body: RequestBody<AddInternalNoteOp>,
): Promise<B2CTicketMessage> {
  return apiPost(b2cTicketsPaths.notes, { path: { ticket_id: ticketId }, body });
}

export function resolveB2CSupportTicket(
  ticketId: string,
  body: RequestBody<ResolveB2CTicketOp>,
): Promise<B2CResolutionResponse> {
  return apiPost(b2cTicketsPaths.resolve, { path: { ticket_id: ticketId }, body });
}

export function listB2CSupportTicketActivities(ticketId: string): Promise<B2CTicketActivity[]> {
  return apiGet(b2cTicketsPaths.activity, { path: { ticket_id: ticketId } });
}

export function getB2CSupportTicketCustomer(ticketId: string): Promise<B2CCustomerContext> {
  return apiGet(b2cTicketsPaths.customer, { path: { ticket_id: ticketId } });
}

export function getSupportAnalytics(): Promise<B2CSupportAnalytics> {
  return apiGet(b2cTicketsPaths.analytics);
}

export function listSupportAgents(): Promise<SupportAgent[]> {
  return apiGet(b2cTicketsPaths.agents);
}

export function listAdminSupportCategories(activeOnly: boolean = false): Promise<SupportCategory[]> {
  return apiGet(b2cTicketsPaths.categories, { query: { active_only: activeOnly } });
}

export function createAdminSupportCategory(body: CreateSupportCategoryRequest): Promise<SupportCategory> {
  return apiPost(b2cTicketsPaths.categories, { body });
}

export function updateAdminSupportCategory(
  categoryId: string,
  body: Partial<CreateSupportCategoryRequest>,
): Promise<SupportCategory> {
  return apiPatch(b2cTicketsPaths.category, { path: { category_id: categoryId }, body });
}

export function getAdminSupportAttachmentDownloadUrl(attachmentId: string): Promise<{ download_url: string }> {
  return apiGet(b2cTicketsPaths.downloadAttachment, { path: { attachment_id: attachmentId } });
}

export async function uploadAdminSupportAttachment(
  file: File,
  ticketId?: string,
): Promise<B2CTicketAttachment> {
  const presign = await apiPost<SuccessResponse<PresignAdminAttachmentOp>>(
    b2cTicketsPaths.presignAttachment,
    {
      body: {
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        ticket_id: ticketId,
      },
    },
  );

  const headers = new Headers();
  headers.set("Content-Type", file.type || "application/octet-stream");

  const uploadRes = await fetch(presign.upload_url, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!uploadRes.ok) {
    throw new Error(`Attachment upload failed (${uploadRes.status}): ${uploadRes.statusText}`);
  }

  return apiPost<B2CTicketAttachment>(b2cTicketsPaths.confirmAttachment, {
    path: { attachment_id: presign.attachment_id },
  });
}

export const b2cTicketsQueries = {
  categories: (activeOnly?: boolean) =>
    queryOptions({
      queryKey: b2cTicketsKeys.categories(),
      queryFn: () => listAdminSupportCategories(activeOnly),
      staleTime: 60_000,
    }),
  analytics: () =>
    queryOptions({
      queryKey: b2cTicketsKeys.analytics(),
      queryFn: getSupportAnalytics,
      staleTime: 30_000,
    }),
  agents: () =>
    queryOptions({
      queryKey: b2cTicketsKeys.agents(),
      queryFn: listSupportAgents,
      staleTime: 5 * 60_000,
    }),
  list: (params?: B2CTicketsParams) =>
    queryOptions({
      queryKey: b2cTicketsKeys.list(params),
      queryFn: () => listB2CSupportTickets(params),
    }),
  detail: (ticketId: string) =>
    queryOptions({
      queryKey: b2cTicketsKeys.detail(ticketId),
      queryFn: () => getB2CSupportTicket(ticketId),
    }),
  activity: (ticketId: string) =>
    queryOptions({
      queryKey: b2cTicketsKeys.activity(ticketId),
      queryFn: () => listB2CSupportTicketActivities(ticketId),
    }),
  customer: (ticketId: string) =>
    queryOptions({
      queryKey: b2cTicketsKeys.customer(ticketId),
      queryFn: () => getB2CSupportTicketCustomer(ticketId),
    }),
};

import { queryOptions } from "@tanstack/react-query";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api/client";
import type { PathParams, QueryParams, RequestBody, SuccessResponse } from "@/lib/api/operation-types";

/** B2C consultations management (`/admin/consultations-b2c`); the legacy read-only screens live in `learning/consultations.ts`. */

type OverviewOp = "overview_api_v1_admin_consultations_b2c_overview_get";
type TopOp = "top_api_v1_admin_consultations_b2c_top_get";
type ExpertsOp = "list_experts_api_v1_admin_consultations_b2c_experts_get";
type ExpertOp = "get_expert_api_v1_admin_consultations_b2c_experts__consultant_id__get";
type SlotsOp = "expert_slots_api_v1_admin_consultations_b2c_experts__consultant_id__slots_get";
type AddSlotsOp = "add_slots_api_v1_admin_consultations_b2c_experts__consultant_id__slots_post";
type UpdateSlotOp = "update_slot_api_v1_admin_consultations_b2c_experts__consultant_id__slots__slot_id__patch";
type DeleteSlotOp = "delete_slot_api_v1_admin_consultations_b2c_experts__consultant_id__slots__slot_id__delete";
type UpdateExpertOp = "update_expert_api_v1_admin_consultations_b2c_experts__consultant_id__patch";
type CreateServiceOp = "create_expert_service_api_v1_admin_consultations_b2c_experts__consultant_id__services_post";
type UpdateServiceOp = "update_expert_service_api_v1_admin_consultations_b2c_experts__consultant_id__services__service_id__patch";
type DeleteServiceOp = "delete_expert_service_api_v1_admin_consultations_b2c_experts__consultant_id__services__service_id__delete";
type ImportLegacyOp = "import_legacy_consultations_api_v1_admin_consultations_b2c_import_legacy_post";
type BookingsOp = "list_bookings_api_v1_admin_consultations_b2c_bookings_get";
type BookingOp = "get_booking_api_v1_admin_consultations_b2c_bookings__booking_id__get";
type RecordingOp = "booking_recording_api_v1_admin_consultations_b2c_bookings__booking_id__recording_get";
type AssetsOp = "booking_assets_api_v1_admin_consultations_b2c_bookings__booking_id__assets_get";
type OptionsOp = "reschedule_options_api_v1_admin_consultations_b2c_bookings__booking_id__reschedule_options_get";
type RescheduleOp = "reschedule_api_v1_admin_consultations_b2c_bookings__booking_id__reschedule_post";
type LiveMeetingsOp = "live_meetings_api_v1_admin_consultations_b2c_meetings_live_get";
type OrdersOp = "list_orders_api_v1_admin_consultations_b2c_orders_get";

export type B2cOverview = SuccessResponse<OverviewOp>;
export type B2cTop = SuccessResponse<TopOp>;
export type B2cTopParams = QueryParams<TopOp>;
export type B2cExpertPage = SuccessResponse<ExpertsOp>;
export type B2cExpertRow = B2cExpertPage["items"][number];
export type B2cExpertsParams = QueryParams<ExpertsOp>;
export type B2cExpert = SuccessResponse<ExpertOp>;
export type B2cSlots = SuccessResponse<SlotsOp>;
export type B2cSlot = B2cSlots["items"][number];
export type B2cSlotsParams = QueryParams<SlotsOp>;
export type B2cAddSlotsBody = RequestBody<AddSlotsOp>;
export type B2cUpdateSlotBody = RequestBody<UpdateSlotOp>;
export type B2cExpertService = B2cExpert["services"][number];
export type B2cUpdateExpertBody = RequestBody<UpdateExpertOp>;
export type B2cCreateServiceBody = RequestBody<CreateServiceOp>;
export type B2cUpdateServiceBody = RequestBody<UpdateServiceOp>;
export type B2cDeleteServiceResult = SuccessResponse<DeleteServiceOp>;
export type B2cLegacyImportResult = SuccessResponse<ImportLegacyOp>;
export type B2cBookingPage = SuccessResponse<BookingsOp>;
export type B2cBookingRow = B2cBookingPage["items"][number];
export type B2cBookingsParams = QueryParams<BookingsOp>;
export type B2cBooking = SuccessResponse<BookingOp>;
export type B2cRecording = SuccessResponse<RecordingOp>;
export type B2cAssets = SuccessResponse<AssetsOp>;
export type B2cRescheduleOptions = SuccessResponse<OptionsOp>;
export type B2cRescheduleBody = RequestBody<RescheduleOp>;
export type B2cLiveMeetings = SuccessResponse<LiveMeetingsOp>;
export type B2cLiveMeeting = B2cLiveMeetings["items"][number];
export type B2cOrderPage = SuccessResponse<OrdersOp>;
export type B2cOrderRow = B2cOrderPage["items"][number];
export type B2cOrdersParams = QueryParams<OrdersOp>;

export const B2C_BOOKING_STATUSES = [
  "pending_payment",
  "expired",
  "awaiting_approval",
  "confirmed",
  "in_progress",
  "completed",
  "rejected",
  "refund_pending",
  "no_show_customer",
  "no_show_expert",
  "cancelled",
] as const;

export const consultationAdminPaths = {
  overview: "admin/consultations-b2c/overview",
  top: "admin/consultations-b2c/top",
  experts: "admin/consultations-b2c/experts",
  expert: "admin/consultations-b2c/experts/{consultant_id}",
  expertServices: "admin/consultations-b2c/experts/{consultant_id}/services",
  expertService: "admin/consultations-b2c/experts/{consultant_id}/services/{service_id}",
  importLegacy: "admin/consultations-b2c/import-legacy",
  slots: "admin/consultations-b2c/experts/{consultant_id}/slots",
  slot: "admin/consultations-b2c/experts/{consultant_id}/slots/{slot_id}",
  bookings: "admin/consultations-b2c/bookings",
  booking: "admin/consultations-b2c/bookings/{booking_id}",
  recording: "admin/consultations-b2c/bookings/{booking_id}/recording",
  assets: "admin/consultations-b2c/bookings/{booking_id}/assets",
  rescheduleOptions: "admin/consultations-b2c/bookings/{booking_id}/reschedule-options",
  reschedule: "admin/consultations-b2c/bookings/{booking_id}/reschedule",
  liveMeetings: "admin/consultations-b2c/meetings/live",
  orders: "admin/consultations-b2c/orders",
} as const;

export const consultationAdminKeys = {
  all: ["consultations-b2c"] as const,
  overview: (params: object) => [...consultationAdminKeys.all, "overview", params] as const,
  top: (params: object) => [...consultationAdminKeys.all, "top", params] as const,
  experts: (params?: object) => [...consultationAdminKeys.all, "experts", params ?? {}] as const,
  expert: (id: string) => [...consultationAdminKeys.all, "expert", id] as const,
  slots: (id: string, params?: object) => [...consultationAdminKeys.all, "slots", id, params ?? {}] as const,
  bookings: (params?: object) => [...consultationAdminKeys.all, "bookings", params ?? {}] as const,
  booking: (id: string) => [...consultationAdminKeys.all, "booking", id] as const,
  recording: (id: string) => [...consultationAdminKeys.all, "booking", id, "recording"] as const,
  assets: (id: string) => [...consultationAdminKeys.all, "booking", id, "assets"] as const,
  rescheduleOptions: (id: string) => [...consultationAdminKeys.all, "booking", id, "options"] as const,
  live: () => [...consultationAdminKeys.all, "live"] as const,
  orders: (params?: object) => [...consultationAdminKeys.all, "orders", params ?? {}] as const,
};

type ExpertId = PathParams<ExpertOp>["consultant_id"];
type BookingId = PathParams<BookingOp>["booking_id"];
type SlotId = PathParams<DeleteSlotOp>["slot_id"];

export const getB2cOverview = (query: QueryParams<OverviewOp>): Promise<B2cOverview> =>
  apiGet(consultationAdminPaths.overview, { query });
export const getB2cTop = (query: B2cTopParams): Promise<B2cTop> => apiGet(consultationAdminPaths.top, { query });
export const listB2cExperts = (query: B2cExpertsParams = {}): Promise<B2cExpertPage> =>
  apiGet(consultationAdminPaths.experts, { query });
export const getB2cExpert = (consultant_id: ExpertId): Promise<B2cExpert> =>
  apiGet(consultationAdminPaths.expert, { path: { consultant_id } });
export const listB2cExpertSlots = (consultant_id: ExpertId, query: B2cSlotsParams = {}): Promise<B2cSlots> =>
  apiGet(consultationAdminPaths.slots, { path: { consultant_id }, query });
export const listB2cBookings = (query: B2cBookingsParams = {}): Promise<B2cBookingPage> =>
  apiGet(consultationAdminPaths.bookings, { query });
export const getB2cBooking = (booking_id: BookingId): Promise<B2cBooking> =>
  apiGet(consultationAdminPaths.booking, { path: { booking_id } });
export const getB2cRecording = (booking_id: BookingId): Promise<B2cRecording> =>
  apiGet(consultationAdminPaths.recording, { path: { booking_id } });
export const getB2cAssets = (booking_id: BookingId): Promise<B2cAssets> =>
  apiGet(consultationAdminPaths.assets, { path: { booking_id } });
export const getB2cRescheduleOptions = (booking_id: BookingId): Promise<B2cRescheduleOptions> =>
  apiGet(consultationAdminPaths.rescheduleOptions, { path: { booking_id } });
export const getB2cLiveMeetings = (): Promise<B2cLiveMeetings> => apiGet(consultationAdminPaths.liveMeetings);
export const listB2cOrders = (query: B2cOrdersParams = {}): Promise<B2cOrderPage> =>
  apiGet(consultationAdminPaths.orders, { query });

/** Writes. Each one emails the people affected (expert for availability, student + expert for reschedule). */
export const addB2cSlots = (consultant_id: ExpertId, body: B2cAddSlotsBody): Promise<SuccessResponse<AddSlotsOp>> =>
  apiPost(consultationAdminPaths.slots, { path: { consultant_id }, body });
export const updateB2cSlot = (consultant_id: ExpertId, slot_id: SlotId, body: B2cUpdateSlotBody): Promise<void> =>
  apiPatch(consultationAdminPaths.slot, { path: { consultant_id, slot_id }, body });
export const deleteB2cSlot = (consultant_id: ExpertId, slot_id: SlotId): Promise<void> =>
  apiDelete(consultationAdminPaths.slot, { path: { consultant_id, slot_id } });
/** Expert profile and consultation services (admin edits; prices are saved in USD). */
export const updateB2cExpert = (consultant_id: ExpertId, body: B2cUpdateExpertBody): Promise<B2cExpert> =>
  apiPatch(consultationAdminPaths.expert, { path: { consultant_id }, body });
export const createB2cExpertService = (consultant_id: ExpertId, body: B2cCreateServiceBody): Promise<B2cExpertService> =>
  apiPost(consultationAdminPaths.expertServices, { path: { consultant_id }, body });
export const updateB2cExpertService = (
  consultant_id: ExpertId,
  service_id: PathParams<UpdateServiceOp>["service_id"],
  body: B2cUpdateServiceBody,
): Promise<B2cExpertService> => apiPatch(consultationAdminPaths.expertService, { path: { consultant_id, service_id }, body });
export const deleteB2cExpertService = (
  consultant_id: ExpertId,
  service_id: PathParams<DeleteServiceOp>["service_id"],
): Promise<B2cDeleteServiceResult> => apiDelete(consultationAdminPaths.expertService, { path: { consultant_id, service_id } });
/** Adds legacy consultants/consultations B2C doesn't have yet; `dry_run` (default) only counts them. */
export const importLegacyConsultations = (dry_run: boolean): Promise<B2cLegacyImportResult> =>
  apiPost(consultationAdminPaths.importLegacy, { query: { dry_run } });
export const rescheduleB2cBooking = (booking_id: BookingId, body: B2cRescheduleBody): Promise<B2cBooking> =>
  apiPost(consultationAdminPaths.reschedule, { path: { booking_id }, body });

export const consultationAdminQueries = {
  overview: (params: QueryParams<OverviewOp>) =>
    queryOptions({ queryKey: consultationAdminKeys.overview(params), queryFn: () => getB2cOverview(params) }),
  top: (params: B2cTopParams) =>
    queryOptions({ queryKey: consultationAdminKeys.top(params), queryFn: () => getB2cTop(params) }),
  expert: (id: string) => queryOptions({ queryKey: consultationAdminKeys.expert(id), queryFn: () => getB2cExpert(id) }),
  slots: (id: string, params: B2cSlotsParams = {}) =>
    queryOptions({ queryKey: consultationAdminKeys.slots(id, params), queryFn: () => listB2cExpertSlots(id, params) }),
  booking: (id: string) => queryOptions({ queryKey: consultationAdminKeys.booking(id), queryFn: () => getB2cBooking(id) }),
  recording: (id: string) =>
    queryOptions({ queryKey: consultationAdminKeys.recording(id), queryFn: () => getB2cRecording(id), retry: false, staleTime: 0 }),
  assets: (id: string) => queryOptions({ queryKey: consultationAdminKeys.assets(id), queryFn: () => getB2cAssets(id) }),
  /** Polled by the live page, so it never serves a cached answer. */
  live: () => queryOptions({ queryKey: consultationAdminKeys.live(), queryFn: getB2cLiveMeetings, staleTime: 0, refetchInterval: 10_000 }),
  rescheduleOptions: (id: string) =>
    queryOptions({ queryKey: consultationAdminKeys.rescheduleOptions(id), queryFn: () => getB2cRescheduleOptions(id), staleTime: 0 }),
};

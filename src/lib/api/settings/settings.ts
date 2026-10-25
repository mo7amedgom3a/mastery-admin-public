import { queryOptions } from "@tanstack/react-query";

import { apiGet } from "@/lib/api/client";
import type { QueryParams, SuccessResponse } from "@/lib/api/operation-types";

type SocialOp = "social_links_api_v1_admin_settings_social_links_get";
type EmailsOp = "notification_emails_api_v1_admin_settings_notification_emails_get";
type TagsOp = "tracking_tags_api_v1_admin_settings_tracking_tags_get";
type ModulesOp = "permission_modules_api_v1_admin_settings_permission_modules_get";
type CountriesOp = "countries_api_v1_admin_settings_countries_get";

export type SocialLinks = SuccessResponse<SocialOp>;
export type NotificationEmailPage = SuccessResponse<EmailsOp>;
export type TrackingTagPage = SuccessResponse<TagsOp>;
export type TrackingTagsParams = QueryParams<TagsOp>;
export type PermissionModulePage = SuccessResponse<ModulesOp>;
export type CountryPage = SuccessResponse<CountriesOp>;

/** Site settings (`/admin/settings`): legacy-owned, except countries (`b2c.countries`). */
export const settingsPaths = {
  social: "admin/settings/social-links",
  notificationEmails: "admin/settings/notification-emails",
  tags: "admin/settings/tracking-tags",
  modules: "admin/settings/permission-modules",
  countries: "admin/settings/countries",
} as const;

export const listSocialLinks = (): Promise<SocialLinks> => apiGet(settingsPaths.social);
export const listNotificationEmails = (): Promise<NotificationEmailPage> => apiGet(settingsPaths.notificationEmails);
export const listTags = (params: TrackingTagsParams = {}): Promise<TrackingTagPage> =>
  apiGet(settingsPaths.tags, { query: params });
export const listModules = (): Promise<PermissionModulePage> => apiGet(settingsPaths.modules);
export const listCountries = (): Promise<CountryPage> => apiGet(settingsPaths.countries);

export const settingsKeys = {
  all: ["settings"] as const,
  social: () => [...settingsKeys.all, "social"] as const,
  notificationEmails: () => [...settingsKeys.all, "notification-emails"] as const,
  tags: (params?: TrackingTagsParams) => [...settingsKeys.all, "tags", params ?? {}] as const,
  countries: () => [...settingsKeys.all, "countries"] as const,
  modules: () => [...settingsKeys.all, "modules"] as const,
};

export const settingsQueries = {
  social: () => queryOptions({ queryKey: settingsKeys.social(), queryFn: listSocialLinks }),
  notificationEmails: () =>
    queryOptions({ queryKey: settingsKeys.notificationEmails(), queryFn: listNotificationEmails }),
  tags: (params?: TrackingTagsParams) => queryOptions({ queryKey: settingsKeys.tags(params), queryFn: () => listTags(params) }),
  countries: () => queryOptions({ queryKey: settingsKeys.countries(), queryFn: listCountries }),
  modules: () => queryOptions({ queryKey: settingsKeys.modules(), queryFn: listModules }),
};

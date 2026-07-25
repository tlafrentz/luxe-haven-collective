import { createClient } from "@/lib/supabase/server";
import type { EffectiveSettings, InAppNotification, NotificationsPreferencesRepository } from "../application/notifications-preferences-services";
import { firstUseNotificationPreferences } from "../application/notifications-preferences-services";
import type { UserWorkspacePreferences } from "../domain/notifications-preferences";
import type { WorkspaceAccessContext } from "../domain/team-access";

type Row = Record<string, unknown>;
const string = (value: unknown) => typeof value === "string" ? value : undefined;
const integer = (value: unknown) => typeof value === "number" ? value : 0;

export class SupabaseNotificationsPreferencesRepository implements NotificationsPreferencesRepository {
  async get(context: WorkspaceAccessContext): Promise<EffectiveSettings> {
    const supabase = await createClient();
    let propertyQuery = supabase.from("properties").select("id,name").eq("owner_id", context.workspaceId).eq("status", "active");
    if (context.propertyAccess.type === "none") propertyQuery = propertyQuery.in("id", []);
    if (context.propertyAccess.type === "selected") propertyQuery = propertyQuery.in("id", [...context.propertyAccess.propertyIds]);
    const [notificationResult, preferenceResult, propertyResult, listResult, ownerResult] = await Promise.all([
      supabase.from("user_notification_preferences").select("*").eq("workspace_id", context.workspaceId).eq("profile_id", context.profileId).maybeSingle(),
      supabase.from("user_workspace_preferences").select("*").eq("workspace_id", context.workspaceId).eq("profile_id", context.profileId).maybeSingle(),
      propertyQuery.order("name"),
      supabase.from("notifications").select("id,category,urgency,title,body,action_url,status,required,created_at").eq("workspace_id", context.workspaceId).eq("recipient_profile_id", context.profileId).order("created_at", { ascending: false }).limit(50),
      supabase.from("owners").select("timezone,language").eq("id", context.workspaceId).single(),
    ]);
    for (const result of [notificationResult, preferenceResult, propertyResult, listResult, ownerResult]) if (result.error) throw new Error(`Notification and preference settings could not be loaded: ${result.error.message}`);
    const owner = ownerResult.data as Row;
    const n = notificationResult.data as Row | null;
    const p = preferenceResult.data as Row | null;
    const fallbackTimezone = string(owner.timezone) ?? "America/Chicago";
    const notifications = n ? {
      profileId: context.profileId, workspaceId: context.workspaceId,
      channels: n.channels as EffectiveSettings["notifications"]["channels"],
      subscriptions: n.subscriptions as EffectiveSettings["notifications"]["subscriptions"],
      digest: n.digest as EffectiveSettings["notifications"]["digest"],
      quietHours: n.quiet_hours as EffectiveSettings["notifications"]["quietHours"],
      timezone: string(n.timezone) ?? fallbackTimezone, confirmed: Boolean(n.confirmed),
      revision: integer(n.revision), updatedAt: string(n.updated_at) ?? "",
    } : firstUseNotificationPreferences(context.profileId, context.workspaceId, context.role, fallbackTimezone);
    const preferences: UserWorkspacePreferences = {
      profileId: context.profileId, workspaceId: context.workspaceId, timezone: string(p?.timezone),
      locale: string(p?.locale) ?? string(owner.language) ?? "en-US",
      defaultLandingPage: (string(p?.default_landing_page) ?? "home") as UserWorkspacePreferences["defaultLandingPage"],
      defaultPropertyMode: (string(p?.default_property_mode) ?? "all-accessible") as UserWorkspacePreferences["defaultPropertyMode"],
      defaultPropertyId: string(p?.default_property_id),
      dateFormat: (string(p?.date_format) ?? "system") as UserWorkspacePreferences["dateFormat"],
      timeFormat: (string(p?.time_format) ?? "system") as UserWorkspacePreferences["timeFormat"],
      density: (string(p?.display_density) ?? "comfortable") as UserWorkspacePreferences["density"],
      motion: (string(p?.motion_preference) ?? "system") as UserWorkspacePreferences["motion"],
      intelligenceDetail: (string(p?.intelligence_detail) ?? "standard") as UserWorkspacePreferences["intelligenceDetail"],
      revision: integer(p?.revision), updatedAt: string(p?.updated_at) ?? "",
    };
    const notificationsList = (listResult.data as Row[]).map((row): InAppNotification => ({
      id: String(row.id), category: String(row.category), urgency: String(row.urgency), title: String(row.title), body: String(row.body),
      actionUrl: string(row.action_url), status: row.status as InAppNotification["status"], required: Boolean(row.required), createdAt: String(row.created_at),
    }));
    return { notifications, preferences, notificationSource: notifications.confirmed ? "customized" : "role-default", timezoneSource: preferences.timezone ? "user" : string(owner.timezone) ? "organization" : "platform", properties: (propertyResult.data as Row[]).map((row) => ({ id: String(row.id), name: String(row.name) })), notificationsList, unreadCount: notificationsList.filter(({ status }) => status === "unread").length };
  }
  async save(input: Parameters<NotificationsPreferencesRepository["save"]>[0]) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("update_personal_workspace_settings", { p_workspace_id: input.context.workspaceId, p_section: input.section, p_payload: input.payload, p_expected_revision: input.expectedRevision, p_command_id: input.commandId });
    if (error) throw new Error(error.message); return Number(data);
  }
  async updateNotification(context: WorkspaceAccessContext, notificationId: string, status: "read" | "dismissed") {
    const supabase = await createClient(); const { error } = await supabase.rpc("update_notification_state", { p_notification_id: notificationId, p_status: status });
    if (error) throw new Error(error.message);
  }
}

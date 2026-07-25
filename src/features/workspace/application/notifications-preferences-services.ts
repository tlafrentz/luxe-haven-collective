import {
  normalizeNotificationPreferences, resolveDefaultLanding, resolveDefaultProperty,
  roleNotificationDefaults, validLocale, validTimezone, PreferencePolicyError,
  type UserNotificationPreferences, type UserWorkspacePreferences,
} from "../domain/notifications-preferences";
import type { WorkspaceAccessContext } from "../domain/team-access";

export type InAppNotification = Readonly<{
  id: string; category: string; urgency: string; title: string; body: string;
  actionUrl?: string; status: "unread" | "read" | "dismissed" | "expired";
  required: boolean; createdAt: string;
}>;
export type EffectiveSettings = Readonly<{
  notifications: UserNotificationPreferences;
  preferences: UserWorkspacePreferences;
  notificationSource: "customized" | "role-default";
  timezoneSource: "user" | "organization" | "platform";
  properties: readonly Readonly<{ id: string; name: string }>[];
  notificationsList: readonly InAppNotification[];
  unreadCount: number;
}>;
export interface NotificationsPreferencesRepository {
  get(context: WorkspaceAccessContext): Promise<EffectiveSettings>;
  save(input: Readonly<{ context: WorkspaceAccessContext; section: "notifications" | "preferences"; payload: unknown; expectedRevision: number; commandId: string }>): Promise<number>;
  updateNotification(context: WorkspaceAccessContext, notificationId: string, status: "read" | "dismissed"): Promise<void>;
}

export async function getEffectiveWorkspaceSettings(repository: NotificationsPreferencesRepository, context: WorkspaceAccessContext) {
  if (context.status !== "active") throw new PreferencePolicyError("INACCESSIBLE_ROUTE", "Active workspace membership is required.");
  return repository.get(context);
}
export async function updateNotificationPreferences(repository: NotificationsPreferencesRepository, context: WorkspaceAccessContext, value: UserNotificationPreferences, expectedRevision: number, commandId: string) {
  const normalized = normalizeNotificationPreferences(value, context.propertyAccess);
  return repository.save({ context, section: "notifications", payload: normalized, expectedRevision, commandId });
}
export async function updateWorkspacePreferences(repository: NotificationsPreferencesRepository, context: WorkspaceAccessContext, value: UserWorkspacePreferences, expectedRevision: number, commandId: string) {
  if (value.timezone && !validTimezone(value.timezone)) throw new PreferencePolicyError("INVALID_TIMEZONE", "Choose a valid IANA timezone.");
  if (!validLocale(value.locale)) throw new PreferencePolicyError("INVALID_LOCALE", "Choose a valid locale.");
  const landing = resolveDefaultLanding(value.defaultLandingPage, context.role);
  const property = resolveDefaultProperty({ mode: value.defaultPropertyMode, propertyId: value.defaultPropertyId, access: context.propertyAccess });
  return repository.save({ context, section: "preferences", payload: { ...value, defaultLandingPage: landing, defaultPropertyMode: property.mode, defaultPropertyId: "propertyId" in property ? property.propertyId : undefined }, expectedRevision, commandId });
}
export function firstUseNotificationPreferences(profileId: string, workspaceId: string, role: WorkspaceAccessContext["role"], timezone: string): UserNotificationPreferences {
  return { profileId, workspaceId, channels: { inApp: true, email: true }, subscriptions: roleNotificationDefaults(role), digest: { frequency: "weekly", day: 1, time: "08:00" }, quietHours: { enabled: false, start: "22:00", end: "07:00", allowCritical: true }, timezone, confirmed: false, revision: 0, updatedAt: new Date(0).toISOString() };
}

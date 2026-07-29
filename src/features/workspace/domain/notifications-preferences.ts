import type { PropertyAccessScope, WorkspaceRole } from "./team-access";

export const notificationCategories = ["operations", "guests-bookings", "actions", "performance-intelligence", "properties-systems", "team-security"] as const;
export type NotificationCategory = typeof notificationCategories[number];
export type NotificationChannel = "in-app" | "email";
export type NotificationUrgency = "critical" | "action-required" | "informational";
export type NotificationFrequency = "immediate" | "daily-digest" | "weekly-digest" | "off";
export type NotificationStatus = "unread" | "read" | "dismissed" | "expired";

export const requiredNotificationEvents = Object.freeze([
  "workspace-invitation", "role-changed", "property-access-changed",
  "membership-suspended", "membership-removed",
  "provider-authorization-expired", "connected-system-disconnected",
  "critical-security-event",
]);

export type NotificationSubscription = Readonly<{
  category: NotificationCategory;
  frequency: NotificationFrequency;
  channels: readonly NotificationChannel[];
  propertyScope?: Readonly<{ type: "all-accessible" }> | Readonly<{ type: "selected"; propertyIds: readonly string[] }>;
}>;

export type UserNotificationPreferences = Readonly<{
  profileId: string; workspaceId: string;
  channels: Readonly<{ inApp: boolean; email: boolean }>;
  subscriptions: readonly NotificationSubscription[];
  digest: Readonly<{ frequency: "daily" | "weekly" | "off"; day: number; time: string }>;
  quietHours: Readonly<{ enabled: boolean; start: string; end: string; allowCritical: true }>;
  timezone: string; confirmed: boolean; revision: number; updatedAt: string;
}>;

export type UserWorkspacePreferences = Readonly<{
  profileId: string; workspaceId: string; timezone?: string; locale: string;
  defaultLandingPage: "home" | "workspace" | "bookings" | "actions" | "intelligence";
  defaultPropertyMode: "all-accessible" | "last-used" | "specific";
  defaultPropertyId?: string;
  dateFormat: "system" | "mdy" | "medium";
  timeFormat: "system" | "12-hour" | "24-hour";
  density: "comfortable" | "compact";
  motion: "system" | "reduced";
  intelligenceDetail: "summary" | "standard" | "detailed";
  revision: number; updatedAt: string;
}>;

export class PreferencePolicyError extends Error {
  constructor(readonly code: "INVALID_TIMEZONE" | "INVALID_LOCALE" | "INVALID_QUIET_HOURS" | "REQUIRED_NOTIFICATION" | "INACCESSIBLE_PROPERTY" | "INACCESSIBLE_ROUTE", message: string) {
    super(message); this.name = "PreferencePolicyError";
  }
}

export function validTimezone(value: string) {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true; } catch { return false; }
}
export function validLocale(value: string) {
  try { return Intl.getCanonicalLocales(value).length === 1; } catch { return false; }
}
const minutes = (value: string) => {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new PreferencePolicyError("INVALID_QUIET_HOURS", "Quiet hours must use a valid 24-hour time.");
  const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute;
};
export function quietHoursActive(input: Readonly<{ enabled: boolean; start: string; end: string }>, localTime: string) {
  if (!input.enabled) return false;
  const start = minutes(input.start), end = minutes(input.end), current = minutes(localTime);
  return start === end || (start < end ? current >= start && current < end : current >= start || current < end);
}
export function notificationMayDeliver(input: Readonly<{ urgency: NotificationUrgency; frequency: NotificationFrequency; quiet: boolean }>) {
  if (input.frequency === "off") return "suppressed";
  if (input.urgency === "critical") return "immediate";
  return input.quiet ? "deferred" : input.frequency;
}
export function deduplicationKey(input: Readonly<{ workspaceId: string; recipientId: string; event: string; subjectId: string; sourceId: string }>) {
  return [input.workspaceId, input.recipientId, input.event, input.subjectId, input.sourceId].join(":");
}
export function notificationEligible(input: Readonly<{
  membershipActive: boolean; event: string; propertyId?: string;
  propertyAccess: PropertyAccessScope; categoryFrequency: NotificationFrequency;
}>) {
  if (!input.membershipActive) return false;
  if (input.propertyId) {
    if (input.propertyAccess.type === "none") return false;
    if (input.propertyAccess.type === "selected" && !input.propertyAccess.propertyIds.includes(input.propertyId)) return false;
  }
  return requiredNotificationEvents.includes(input.event) || input.categoryFrequency !== "off";
}
export function roleNotificationDefaults(role: WorkspaceRole): readonly NotificationSubscription[] {
  const categories: NotificationCategory[] = role === "viewer"
    ? ["performance-intelligence", "team-security"]
    : role === "contributor" ? ["actions", "team-security"]
      : role === "operator" ? ["operations", "guests-bookings", "actions", "properties-systems", "team-security"]
        : [...notificationCategories];
  return categories.map((category): NotificationSubscription => Object.freeze({
    category, frequency: category === "performance-intelligence" ? "weekly-digest" : "immediate",
    channels: Object.freeze<NotificationChannel[]>(category === "team-security" ? ["in-app", "email"] : ["in-app"]),
    propertyScope: category === "team-security" ? undefined : Object.freeze({ type: "all-accessible" as const }),
  }));
}
export function normalizeNotificationPreferences(value: UserNotificationPreferences, access: PropertyAccessScope): UserNotificationPreferences {
  if (!validTimezone(value.timezone)) throw new PreferencePolicyError("INVALID_TIMEZONE", "Choose a valid IANA timezone.");
  minutes(value.quietHours.start); minutes(value.quietHours.end);
  const accessible = access.type === "selected" ? new Set(access.propertyIds) : null;
  const seen = new Set<NotificationCategory>();
  for (const subscription of value.subscriptions) {
    if (!notificationCategories.includes(subscription.category) || seen.has(subscription.category) || !["immediate", "daily-digest", "weekly-digest", "off"].includes(subscription.frequency)) {
      throw new PreferencePolicyError("INACCESSIBLE_ROUTE", "Notification preferences contain an unsupported category or value.");
    }
    seen.add(subscription.category);
    if (subscription.propertyScope?.type === "selected" && (access.type === "none" || subscription.propertyScope.propertyIds.some((id) => accessible && !accessible.has(id)))) {
      throw new PreferencePolicyError("INACCESSIBLE_PROPERTY", "Notification scope contains an inaccessible property.");
    }
  }
  const subscriptions = notificationCategories.map((category) => value.subscriptions.find((item) => item.category === category) ?? {
    category, frequency: "off" as const, channels: ["in-app"] as const, propertyScope: { type: "all-accessible" as const },
  });
  return Object.freeze({ ...value, subscriptions: Object.freeze(subscriptions), quietHours: Object.freeze({ ...value.quietHours, allowCritical: true as const }) });
}
export function resolveDefaultLanding(value: UserWorkspacePreferences["defaultLandingPage"], role: WorkspaceRole) {
  if (value === "intelligence" && !["owner", "administrator", "operator", "viewer"].includes(role)) return "home";
  return value;
}
export function resolveDefaultProperty(input: Readonly<{ mode: UserWorkspacePreferences["defaultPropertyMode"]; propertyId?: string; access: PropertyAccessScope; archivedIds?: readonly string[] }>) {
  if (input.mode !== "specific" || !input.propertyId) return { mode: input.mode };
  const permitted = input.access.type === "all" || (input.access.type === "selected" && input.access.propertyIds.includes(input.propertyId));
  return permitted && !input.archivedIds?.includes(input.propertyId) ? { mode: "specific" as const, propertyId: input.propertyId } : { mode: "all-accessible" as const };
}

import { describe, expect, it } from "vitest";
import { deduplicationKey, normalizeNotificationPreferences, notificationEligible, notificationMayDeliver, quietHoursActive, resolveDefaultLanding, resolveDefaultProperty, roleNotificationDefaults, validLocale, validTimezone } from "./notifications-preferences";

describe("notification and personal preference policy", () => {
  it("handles ordinary and overnight quiet hours", () => {
    expect(quietHoursActive({ enabled: true, start: "22:00", end: "07:00" }, "23:30")).toBe(true);
    expect(quietHoursActive({ enabled: true, start: "22:00", end: "07:00" }, "06:30")).toBe(true);
    expect(quietHoursActive({ enabled: true, start: "22:00", end: "07:00" }, "12:00")).toBe(false);
  });
  it("materializes every supported category without overwriting existing values", () => {
    const normalized = normalizeNotificationPreferences({
      profileId: "profile-1", workspaceId: "workspace-1",
      channels: { inApp: true, email: false },
      subscriptions: [{ category: "operations", frequency: "daily-digest", channels: ["in-app"], propertyScope: { type: "all-accessible" } }],
      digest: { frequency: "daily", day: 1, time: "08:00" },
      quietHours: { enabled: false, start: "22:00", end: "07:00", allowCritical: true },
      timezone: "America/Chicago", confirmed: true, revision: 1, updatedAt: "2026-07-28T00:00:00Z",
    }, { type: "all" });
    expect(normalized.subscriptions).toHaveLength(6);
    expect(normalized.subscriptions.find((item) => item.category === "operations")?.frequency).toBe("daily-digest");
    expect(normalized.subscriptions.find((item) => item.category === "guests-bookings")?.frequency).toBe("off");
  });
  it("lets critical events bypass quiet hours", () => {
    expect(notificationMayDeliver({ urgency: "critical", frequency: "immediate", quiet: true })).toBe("immediate");
    expect(notificationMayDeliver({ urgency: "action-required", frequency: "immediate", quiet: true })).toBe("deferred");
  });
  it("builds stable deduplication keys", () => {
    const input = { workspaceId: "w", recipientId: "r", event: "sync-failed", subjectId: "p", sourceId: "run" };
    expect(deduplicationKey(input)).toBe(deduplicationKey(input));
  });
  it("uses role-aware, least-noisy defaults", () => {
    expect(roleNotificationDefaults("viewer").map(({ category }) => category)).toEqual(["performance-intelligence", "team-security"]);
    expect(roleNotificationDefaults("owner").length).toBe(6);
  });
  it("validates stable timezone and locale identifiers", () => {
    expect(validTimezone("America/Chicago")).toBe(true); expect(validTimezone("-0600")).toBe(false);
    expect(validLocale("en-US")).toBe(true); expect(validLocale("not_a_locale!")).toBe(false);
  });
  it("falls back from inaccessible routes and properties", () => {
    expect(resolveDefaultLanding("intelligence", "contributor")).toBe("home");
    expect(resolveDefaultProperty({ mode: "specific", propertyId: "p2", access: { type: "selected", propertyIds: ["p1"] } })).toEqual({ mode: "all-accessible" });
  });
  it("evaluates authorization before notification generation", () => {
    expect(notificationEligible({ membershipActive: false, event: "role-changed", propertyAccess: { type: "all" }, categoryFrequency: "immediate" })).toBe(false);
    expect(notificationEligible({ membershipActive: true, event: "sync-failed", propertyId: "p2", propertyAccess: { type: "selected", propertyIds: ["p1"] }, categoryFrequency: "immediate" })).toBe(false);
    expect(notificationEligible({ membershipActive: true, event: "role-changed", propertyAccess: { type: "none" }, categoryFrequency: "off" })).toBe(true);
  });
});

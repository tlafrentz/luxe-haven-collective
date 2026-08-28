import type { NotificationFrequency } from "./notifications-preferences";

export type DigestFrequency = "immediate" | "daily" | "weekly";

export function localDigestParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { date: `${value("year")}-${value("month")}-${value("day")}`, weekday: value("weekday"), time: `${value("hour")}:${value("minute")}` };
}

export function digestPeriod(input: Readonly<{ now: Date; timezone: string; frequency: NotificationFrequency; digest: Readonly<{ frequency: "daily"|"weekly"|"off"; day: number; time: string }> }>): Readonly<{ frequency: DigestFrequency; periodKey: string }>|null {
  if (input.frequency === "off") return null;
  const local = localDigestParts(input.now, input.timezone);
  if (input.frequency === "immediate") return { frequency: "immediate", periodKey: input.now.toISOString().slice(0, 16) };
  if (input.frequency === "daily-digest") {
    if (input.digest.frequency === "off" || local.time < input.digest.time) return null;
    return { frequency: "daily", periodKey: local.date };
  }
  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  if (input.digest.frequency !== "weekly" || weekdays[input.digest.day] !== local.weekday || local.time < input.digest.time) return null;
  return { frequency: "weekly", periodKey: local.date };
}

export function nextDigestDelivery(now: Date, timezone: string, digest: Readonly<{ frequency: "daily"|"weekly"|"off"; day: number; time: string }>) {
  if (digest.frequency === "off") return null;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", month: "short", day: "numeric" });
  for (let offset = 0; offset < 8; offset += 1) {
    const candidate = new Date(now.getTime() + offset * 86_400_000);
    const local = localDigestParts(candidate, timezone);
    const weekday = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(local.weekday);
    if (digest.frequency === "daily" || weekday === digest.day) {
      if (offset > 0 || local.time < digest.time) return `${formatter.format(candidate)} at ${digest.time} (${timezone})`;
    }
  }
  return null;
}

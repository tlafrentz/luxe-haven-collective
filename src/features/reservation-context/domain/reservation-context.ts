export type GuestIdentityStatus =
  | "resolved"
  | "provisional"
  | "ambiguous"
  | "unidentified";

export type GuestName = Readonly<{
  display: string;
  given: string | null;
  family: string | null;
  complete: boolean;
}>;

export type GuestContactPoint = Readonly<{
  type: "email" | "phone";
  value: string;
  verified: boolean;
}>;

export type ProviderGuestReference = Readonly<{
  provider: string;
  externalGuestId: string;
  lastObservedAt: string;
}>;

export type GuestIdentity = Readonly<{
  guestId: string;
  status: GuestIdentityStatus;
  providerReferences: readonly ProviderGuestReference[];
}>;

export type Guest = Readonly<{
  identity: GuestIdentity;
  name: GuestName;
  language: string | null;
  contactPoints: readonly GuestContactPoint[];
}>;

export type ReservationParty = Readonly<{
  adults: number | null;
  children: number | null;
  infants: number | null;
  pets: number | null;
  totalGuests: number | null;
  inconsistent: boolean;
}>;

export type StayStage =
  | "inquiry"
  | "confirmed"
  | "pre-arrival"
  | "arriving-today"
  | "in-stay"
  | "departing-today"
  | "post-stay"
  | "closed"
  | "cancelled"
  | "no-show"
  | "unknown";

export type StayWindow = Readonly<{
  arrivalDate: string;
  departureDate: string;
  checkInTime: string;
  checkoutTime: string;
  timezone: string;
  timezoneSource: "property" | "workspace" | "platform-fallback";
  timingConfidence: "high" | "reduced";
}>;

export type PropertyContext = Readonly<{
  id: string;
  name: string;
  marketLabel: string | null;
  timezone: string;
  checkInTime: string;
  checkoutTime: string;
  operationalStatus: string;
  guidebookAvailable: boolean;
  primaryImage: string | null;
}>;

export type ContactChannel =
  | "platform-messaging"
  | "email"
  | "sms"
  | "phone";

export type ContactAvailability = Readonly<{
  platformMessaging: boolean;
  email: boolean;
  sms: boolean;
  phone: boolean;
  preferredChannel: ContactChannel | null;
  state:
    | "available"
    | "no-direct-contact"
    | "unknown";
}>;

export type ContextFreshness = Readonly<{
  bookingObservedAt: string | null;
  guestObservedAt: string | null;
  propertyObservedAt: string | null;
  providerAvailable: boolean;
  status: "current" | "stale" | "degraded" | "unknown";
}>;

export type ReservationContext = Readonly<{
  reservationId: string;
  bookingId: string;
  workspaceId: string;
  guest: Guest;
  party: ReservationParty;
  property: PropertyContext;
  stay: Readonly<{ window: StayWindow; stage: StayStage }>;
  contactAvailability: ContactAvailability;
  source: Readonly<{ bookingSource: string; providerLabel: string }>;
  provenance: Readonly<{
    provider: string | null;
    externalReservationId: string | null;
    externalGuestId: string | null;
    lastObservedAt: string | null;
  }>;
  freshness: ContextFreshness;
  operationalNeeds: readonly (
    | "guest-details-incomplete"
    | "contact-unavailable"
    | "identity-review"
    | "timing-confidence-reduced"
    | "context-stale"
  )[];
}>;

export type ReservationStatus =
  | "inquiry"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no-show"
  | "unknown";

const PLATFORM_TIMEZONE_FALLBACK = "America/Chicago";

export function normalizeGuestName(input: Readonly<{
  given?: string | null;
  family?: string | null;
  display?: string | null;
}>): GuestName {
  const given = input.given?.trim().replace(/\s+/g, " ") || null;
  const family = input.family?.trim().replace(/\s+/g, " ") || null;
  const suppliedDisplay = input.display?.trim().replace(/\s+/g, " ") || null;
  const display = suppliedDisplay || [given, family].filter(Boolean).join(" ");

  return {
    display: display || "Guest",
    given,
    family,
    complete: Boolean(display),
  };
}

function normalizeCount(value: number | null | undefined): number | null {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

export function normalizeReservationParty(
  input: Readonly<{
    adults?: number | null;
    children?: number | null;
    infants?: number | null;
    pets?: number | null;
    totalGuests?: number | null;
  }>,
): ReservationParty {
  const adults = normalizeCount(input.adults);
  const children = normalizeCount(input.children);
  const infants = normalizeCount(input.infants);
  const pets = normalizeCount(input.pets);
  const totalGuests = normalizeCount(input.totalGuests);
  const knownPeople = [adults, children, infants].every(
    (value) => value !== null,
  )
    ? Number(adults) + Number(children) + Number(infants)
    : null;

  return {
    adults,
    children,
    infants,
    pets,
    totalGuests,
    inconsistent:
      knownPeople !== null &&
      totalGuests !== null &&
      knownPeople !== totalGuests,
  };
}

export function resolvePropertyTimezone({
  propertyTimezone,
  workspaceTimezone,
}: Readonly<{
  propertyTimezone?: string | null;
  workspaceTimezone?: string | null;
}>): Pick<StayWindow, "timezone" | "timezoneSource" | "timingConfidence"> {
  const candidates = [
    ["property", propertyTimezone],
    ["workspace", workspaceTimezone],
    ["platform-fallback", PLATFORM_TIMEZONE_FALLBACK],
  ] as const;

  for (const [source, timezone] of candidates) {
    if (!timezone) continue;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
      return {
        timezone,
        timezoneSource: source,
        timingConfidence: source === "property" ? "high" : "reduced",
      };
    } catch {
      continue;
    }
  }

  return {
    timezone: PLATFORM_TIMEZONE_FALLBACK,
    timezoneSource: "platform-fallback",
    timingConfidence: "reduced",
  };
}

function localDateAndMinutes(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

function timeToMinutes(value: string, fallback: number): number {
  const twelveHour = value
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]) % 12;
    return hour * 60 + Number(twelveHour[2]) +
      (twelveHour[3].toUpperCase() === "PM" ? 720 : 0);
  }
  const twentyFourHour = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    return Number(twentyFourHour[1]) * 60 + Number(twentyFourHour[2]);
  }
  return fallback;
}

export function resolveStayStage({
  status,
  window,
  now = new Date(),
  postStayDays = 7,
}: Readonly<{
  status: ReservationStatus;
  window: StayWindow;
  now?: Date;
  postStayDays?: number;
}>): StayStage {
  if (status === "cancelled") return "cancelled";
  if (status === "no-show") return "no-show";
  if (status === "inquiry") return "inquiry";
  if (status === "unknown") return "unknown";

  const local = localDateAndMinutes(now, window.timezone);
  const departureEnd = Date.parse(`${window.departureDate}T00:00:00.000Z`);
  const localDay = Date.parse(`${local.date}T00:00:00.000Z`);

  if (local.date < window.arrivalDate)
    return status === "confirmed" ? "pre-arrival" : "confirmed";
  if (local.date === window.arrivalDate) {
    return local.minutes >= timeToMinutes(window.checkInTime, 16 * 60)
      ? "in-stay"
      : "arriving-today";
  }
  if (local.date > window.arrivalDate && local.date < window.departureDate)
    return "in-stay";
  if (local.date === window.departureDate) return "departing-today";

  const daysSinceDeparture = Math.floor(
    (localDay - departureEnd) / 86_400_000,
  );
  return daysSinceDeparture <= postStayDays ? "post-stay" : "closed";
}

export function evaluateContactAvailability(input: Readonly<{
  platformMessaging?: boolean | null;
  email?: string | null;
  phone?: string | null;
}>): ContactAvailability {
  const platformMessaging = input.platformMessaging === true;
  const email = Boolean(input.email?.trim());
  const phone = Boolean(input.phone?.trim());
  const sms = phone;
  const preferredChannel: ContactChannel | null = platformMessaging
    ? "platform-messaging"
    : email
      ? "email"
      : sms
        ? "sms"
        : null;

  return {
    platformMessaging,
    email,
    sms,
    phone,
    preferredChannel,
    state:
      platformMessaging || email || phone
        ? "available"
        : input.platformMessaging === null
          ? "unknown"
          : "no-direct-contact",
  };
}

export function evaluateContextFreshness({
  bookingObservedAt,
  guestObservedAt,
  propertyObservedAt,
  providerAvailable,
  now = new Date(),
  staleAfterHours = 24,
  propertyStaleAfterHours = 24 * 30,
}: Omit<ContextFreshness, "status"> &
  Readonly<{
    now?: Date;
    staleAfterHours?: number;
    propertyStaleAfterHours?: number;
  }>): ContextFreshness {
  const parsed = [bookingObservedAt, guestObservedAt, propertyObservedAt].map(
    (value) => (value ? Date.parse(value) : Number.NaN),
  );
  const missing = parsed.some((value) => !Number.isFinite(value));
  const stale =
    parsed.slice(0, 2).some(
      (value) =>
        Number.isFinite(value) &&
        now.getTime() - value > staleAfterHours * 3_600_000,
    ) ||
    (Number.isFinite(parsed[2]) &&
      now.getTime() - parsed[2] > propertyStaleAfterHours * 3_600_000);

  return {
    bookingObservedAt,
    guestObservedAt,
    propertyObservedAt,
    providerAvailable,
    status: !providerAvailable
      ? "degraded"
      : stale
        ? "stale"
        : missing
          ? "unknown"
          : "current",
  };
}

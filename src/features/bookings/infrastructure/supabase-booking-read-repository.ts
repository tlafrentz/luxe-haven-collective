import { createClient } from "@/lib/supabase/server";

import type { BookingReadRepository } from "../application";
import {
  calculateStayNights,
  resolveBookingLifecycle,
  resolveSynchronizationStatus,
  type Booking,
  type StoredBookingStatus,
} from "../domain";
import {
  resolveOwnerIdentity,
  throwOperationalReadError,
} from "@/features/reservation-context/infrastructure/owner-identity";

type BookingRow = Readonly<{
  id: string;
  property_id: string;
  guest_full_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guests: number | null;
  check_in: string;
  check_out: string;
  total_amount: number | string | null;
  currency: string | null;
  status: StoredBookingStatus;
  source: string | null;
  external_provider: string | null;
  booking_code: string | null;
  last_synced_at: string | null;
  properties:
    | Readonly<{
        id: string;
        name: string;
        owner_id: string | null;
        owner?:
          | Readonly<{ profile_id: string }>
          | readonly Readonly<{ profile_id: string }>[];
      }>
    | readonly Readonly<{
        id: string;
        name: string;
        owner_id: string | null;
        owner?:
          | Readonly<{ profile_id: string }>
          | readonly Readonly<{ profile_id: string }>[];
      }>[];
}>;

function relatedProperty(row: BookingRow) {
  return Array.isArray(row.properties) ? row.properties[0] : row.properties;
}

export function mapBookingRow(
  row: BookingRow,
  now = new Date(),
): Booking {
  const property = relatedProperty(row);

  if (!property) {
    throw new Error(`Booking "${row.id}" has no associated property.`);
  }

  return {
    id: row.id,
    confirmationCode: row.booking_code,
    property: { id: property.id, name: property.name },
    guest: {
      name: row.guest_full_name?.trim() || "Guest",
      email: row.guest_email,
      phone: row.guest_phone,
      partySize: row.guests ?? 0,
    },
    stay: {
      arrival: row.check_in,
      departure: row.check_out,
      nights: calculateStayNights(row.check_in, row.check_out),
    },
    status: resolveBookingLifecycle({
      storedStatus: row.status,
      arrival: row.check_in,
      departure: row.check_out,
      now,
    }),
    financial: {
      total: Number(row.total_amount ?? 0),
      currency: row.currency,
    },
    provider: {
      provider: row.external_provider
        ? "Connected hospitality platform"
        : "Luxe Haven",
      source: row.source?.trim() || "Direct",
      lastSynchronizedAt: row.last_synced_at,
      synchronizationStatus: resolveSynchronizationStatus({
        lastSynchronizedAt: row.last_synced_at,
        now,
      }),
    },
  };
}

const selection = `
  id,
  property_id,
  guest_full_name,
  guest_email,
  guest_phone,
  guests,
  check_in,
  check_out,
  total_amount,
  currency,
  status,
  source,
  external_provider,
  booking_code,
  last_synced_at,
  properties!inner (
    id,
    name,
    owner_id
  )
`;

export class SupabaseBookingReadRepository
  implements BookingReadRepository
{
  async list(profileId: string): Promise<readonly Booking[]> {
    const supabase = await createClient();
    const identity = await resolveOwnerIdentity(supabase, profileId);
    if (!identity.ownerId) return [];
    let query = supabase
      .from("bookings")
      .select(selection)
      .eq("properties.owner_id", identity.ownerId);
    if (identity.accessiblePropertyIds) {
      if (!identity.accessiblePropertyIds.length) return [];
      query = query.in("property_id", [...identity.accessiblePropertyIds]);
    }
    const { data, error } = await query.order("check_in", { ascending: true });

    if (error) throwOperationalReadError("Booking list", error);

    return ((data ?? []) as unknown as BookingRow[]).map((row) =>
      mapBookingRow(row),
    );
  }

  async get(profileId: string, bookingId: string): Promise<Booking | null> {
    const supabase = await createClient();
    const identity = await resolveOwnerIdentity(supabase, profileId);
    if (!identity.ownerId) return null;
    if (
      identity.accessiblePropertyIds &&
      !identity.accessiblePropertyIds.includes(
        (
          await supabase
            .from("bookings")
            .select("property_id")
            .eq("id", bookingId)
            .maybeSingle()
        ).data?.property_id ?? ""
      )
    ) return null;
    const { data, error } = await supabase
      .from("bookings")
      .select(selection)
      .eq("id", bookingId)
      .eq("properties.owner_id", identity.ownerId)
      .maybeSingle();

    if (error) throwOperationalReadError("Booking detail", error);

    return data
      ? mapBookingRow(data as unknown as BookingRow)
      : null;
  }
}

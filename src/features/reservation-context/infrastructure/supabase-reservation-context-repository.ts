import { createClient } from "@/lib/supabase/server";

import type {
  ReservationContextRepository,
  ReservationContextSource,
} from "../application";
import type { GuestIdentityStatus, ReservationStatus } from "../domain";
import {
  resolveOwnerIdentity,
  throwOperationalReadError,
} from "./owner-identity";

type ContextRow = Readonly<{
  id: string;
  property_id: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  source: string | null;
  external_provider: string | null;
  external_reservation_id: string | null;
  external_guest_id: string | null;
  booking_code: string | null;
  guest_full_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  guest_language: string | null;
  guests: number | null;
  party_adults: number | null;
  party_children: number | null;
  party_infants: number | null;
  party_pets: number | null;
  check_in: string;
  check_out: string;
  last_synced_at: string | null;
  guest_context_synced_at: string | null;
  primary_guest_id: string | null;
  canonical_guest:
    | Readonly<{
        id: string;
        identity_status: GuestIdentityStatus;
        display_name: string;
        email: string | null;
        phone: string | null;
        language: string | null;
        last_observed_at: string | null;
      }>
    | readonly Readonly<{
        id: string;
        identity_status: GuestIdentityStatus;
        display_name: string;
        email: string | null;
        phone: string | null;
        language: string | null;
        last_observed_at: string | null;
      }>[]
    | null;
  property:
    | Readonly<{
        id: string;
        owner_id: string | null;
        name: string;
        city: string;
        state: string;
        timezone: string | null;
        check_in_time: string;
        check_out_time: string;
        status: string;
        guidebook_available: boolean;
        featured_image: string | null;
        updated_at: string;
      }>
    | readonly Readonly<{
        id: string;
        owner_id: string | null;
        name: string;
        city: string;
        state: string;
        timezone: string | null;
        check_in_time: string;
        check_out_time: string;
        status: string;
        guidebook_available: boolean;
        featured_image: string | null;
        updated_at: string;
      }>[];
}>;

function relation<T>(value: T | readonly T[] | null): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return value as T | null;
}

function mapStatus(status: ContextRow["status"]): ReservationStatus {
  if (status === "pending") return "inquiry";
  return status;
}

export function mapReservationContextRow(
  row: ContextRow,
  profileId?: string,
): ReservationContextSource {
  const property = relation(row.property);
  const guest = relation(row.canonical_guest);
  if (!property?.owner_id || !profileId)
    throw new Error("Reservation context has no owning property.");

  return {
    bookingId: row.id,
    reservationId: row.booking_code ?? row.id,
    ownerId: profileId,
    bookingStatus: mapStatus(row.status),
    bookingSource: row.source?.trim() || "Direct",
    provider: row.external_provider,
    externalReservationId: row.external_reservation_id,
    externalGuestId: row.external_guest_id,
    guestId: guest?.id ?? row.primary_guest_id,
    guestIdentityStatus: guest?.identity_status ?? null,
    guestDisplayName: guest?.display_name ?? row.guest_full_name,
    guestEmail: guest?.email ?? row.guest_email,
    guestPhone: guest?.phone ?? row.guest_phone,
    guestLanguage: guest?.language ?? row.guest_language,
    partyAdults: row.party_adults,
    partyChildren: row.party_children,
    partyInfants: row.party_infants,
    partyPets: row.party_pets,
    partyTotal: row.guests,
    propertyId: property.id,
    propertyName: property.name,
    propertyMarketLabel:
      [property.city, property.state].filter(Boolean).join(", ") || null,
    propertyTimezone: property.timezone,
    workspaceTimezone: null,
    checkInTime: property.check_in_time,
    checkoutTime: property.check_out_time,
    propertyStatus: property.status,
    guidebookAvailable: property.guidebook_available,
    primaryImage: property.featured_image,
    arrivalDate: row.check_in,
    departureDate: row.check_out,
    platformMessagingAvailable: Boolean(row.external_provider),
    bookingObservedAt: row.last_synced_at,
    guestObservedAt:
      guest?.last_observed_at ?? row.guest_context_synced_at,
    propertyObservedAt: property.updated_at,
    providerAvailable: Boolean(row.last_synced_at),
  };
}

const selection = `
  id,
  property_id,
  status,
  source,
  external_provider,
  external_reservation_id,
  external_guest_id,
  booking_code,
  guest_full_name,
  guest_email,
  guest_phone,
  guest_language,
  guests,
  party_adults,
  party_children,
  party_infants,
  party_pets,
  check_in,
  check_out,
  last_synced_at,
  guest_context_synced_at,
  primary_guest_id,
  canonical_guest:guests (
    id,
    identity_status,
    display_name,
    email,
    phone,
    language,
    last_observed_at
  ),
  property:properties!inner (
    id,
    owner_id,
    name,
    city,
    state,
    timezone,
    check_in_time,
    check_out_time,
    status,
    guidebook_available,
    featured_image,
    updated_at
  )
`;

export class SupabaseReservationContextRepository
  implements ReservationContextRepository
{
  async list(profileId: string): Promise<readonly ReservationContextSource[]> {
    const supabase = await createClient();
    const identity = await resolveOwnerIdentity(supabase, profileId);
    if (!identity.ownerId) return [];
    let query = supabase
      .from("bookings")
      .select(selection)
      .eq("property.owner_id", identity.ownerId);
    if (identity.accessiblePropertyIds) {
      if (!identity.accessiblePropertyIds.length) return [];
      query = query.in("property_id", [...identity.accessiblePropertyIds]);
    }
    const { data, error } = await query.order("check_in", { ascending: true });

    if (error) throwOperationalReadError("Reservation context list", error);
    try {
      return ((data ?? []) as unknown as ContextRow[]).map((row) =>
        mapReservationContextRow(row, identity.ownerProfileId),
      );
    } catch (mappingError) {
      throwOperationalReadError("Reservation context mapping", mappingError as Error);
    }
  }

  async get(
    profileId: string,
    bookingId: string,
  ): Promise<ReservationContextSource | null> {
    const supabase = await createClient();
    const identity = await resolveOwnerIdentity(supabase, profileId);
    if (!identity.ownerId) return null;
    const { data, error } = await supabase
      .from("bookings")
      .select(selection)
      .eq("id", bookingId)
      .eq("property.owner_id", identity.ownerId)
      .maybeSingle();

    if (error) throwOperationalReadError("Reservation context detail", error);
    if (!data) return null;
    try {
      return mapReservationContextRow(
        data as unknown as ContextRow,
        identity.ownerProfileId,
      );
    } catch (mappingError) {
      throwOperationalReadError("Reservation context mapping", mappingError as Error);
    }
  }
}

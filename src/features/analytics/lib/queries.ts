import { createClient } from "@/lib/supabase/server";

import type {
  AnalyticsBooking,
  AnalyticsProperty,
  AnalyticsQueryParams,
} from "../types";

type RawBookingRow = {
  id: string;
  property_id: string;
  guest_full_name: string | null;
  check_in: string;
  check_out: string;
  guests: number | null;
  nightly_rate: number | string | null;
  cleaning_fee: number | string | null;
  taxes: number | string | null;
  service_fee: number | string | null;
  total_amount: number | string | null;
  status: string;
  payment_status: string;
  source: string | null;
  created_at: string;
};

function toNumber(value: number | string | null): number {
  if (value === null) {
    return 0;
  }

  const parsedValue =
    typeof value === "number" ? value : Number.parseFloat(value);

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function mapBooking(row: RawBookingRow): AnalyticsBooking {
  return {
    id: row.id,
    propertyId: row.property_id,
    guestFullName: row.guest_full_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guests: row.guests ?? 0,
    nightlyRate: toNumber(row.nightly_rate),
    cleaningFee: toNumber(row.cleaning_fee),
    taxes: toNumber(row.taxes),
    serviceFee: toNumber(row.service_fee),
    totalAmount: toNumber(row.total_amount),
    status: row.status,
    paymentStatus: row.payment_status,
    source: row.source,
    createdAt: row.created_at,
  };
}

export async function getAnalyticsProperties(): Promise<
  AnalyticsProperty[]
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("properties")
    .select("id, name")
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(
      `Unable to load analytics properties: ${error.message}`,
    );
  }

  return (data ?? []).map((property) => ({
    id: property.id,
    name: property.name,
  }));
}

export async function getAnalyticsBookings({
  propertyId,
  startDate,
  endDate,
}: AnalyticsQueryParams): Promise<AnalyticsBooking[]> {
  const supabase = await createClient();

  /*
   * A booking overlaps the reporting period when:
   *
   * check_in < endDate
   * check_out > startDate
   *
   * endDate is exclusive.
   */
  let query = supabase
    .from("bookings")
    .select(`
      id,
      property_id,
      guest_full_name,
      check_in,
      check_out,
      guests,
      nightly_rate,
      cleaning_fee,
      taxes,
      service_fee,
      total_amount,
      status,
      payment_status,
      source,
      created_at
    `)
    .lt("check_in", endDate)
    .gt("check_out", startDate)
    .order("check_in", { ascending: true });

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to load booking analytics: ${error.message}`,
    );
  }

  return ((data ?? []) as RawBookingRow[]).map(mapBooking);
}

export async function getRecentAnalyticsBookings({
  propertyId,
  limit = 5,
}: {
  propertyId?: string | null;
  limit?: number;
}): Promise<AnalyticsBooking[]> {
  const supabase = await createClient();

  let query = supabase
    .from("bookings")
    .select(`
      id,
      property_id,
      guest_full_name,
      check_in,
      check_out,
      guests,
      nightly_rate,
      cleaning_fee,
      taxes,
      service_fee,
      total_amount,
      status,
      payment_status,
      source,
      created_at
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (propertyId) {
    query = query.eq("property_id", propertyId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Unable to load recent bookings: ${error.message}`,
    );
  }

  return ((data ?? []) as RawBookingRow[]).map(mapBooking);
}

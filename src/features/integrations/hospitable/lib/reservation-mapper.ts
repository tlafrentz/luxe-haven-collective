import type {
  HospitableFinancialItem,
  HospitableReservation,
} from "../types";

export type MappedBookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

export type MappedPaymentStatus =
  | "unpaid"
  | "authorized"
  | "paid"
  | "refunded"
  | "failed";

export type HospitableReservationMapping = {
  externalPropertyId: string;
  booking: {
    property_id: string;
    guest_id: string | null;
    guest_full_name: string | null;
    guest_email: string | null;
    guest_phone: string | null;
    check_in: string;
    check_out: string;
    guests: number;
    nightly_rate: number;
    cleaning_fee: number;
    taxes: number;
    service_fee: number;
    total_amount: number;
    status: MappedBookingStatus;
    payment_status: MappedPaymentStatus;
    stripe_payment_intent_id: null;
    source: string;
    notes: string | null;
    external_provider: "hospitable";
    external_reservation_id: string;
    external_property_id: string;
    external_platform: string;
    booking_code: string | null;
    external_guest_id: string | null;
    currency: string | null;
    host_revenue: number;
    host_service_fee: number;
    discount_amount: number;
    last_synced_at: string;
    raw_payload: HospitableReservation;
  };
};

function centsToCurrency(
  amount: number | null | undefined,
): number {
  if (
    amount === null ||
    amount === undefined ||
    !Number.isFinite(amount)
  ) {
    return 0;
  }

  return Math.round(amount) / 100;
}

function sumFinancialItems(
  items: HospitableFinancialItem[] | null | undefined,
): number {
  return centsToCurrency(
    (items ?? []).reduce(
      (total, item) => total + item.amount,
      0,
    ),
  );
}

function sumAbsoluteFinancialItems(
  items: HospitableFinancialItem[] | null | undefined,
): number {
  return centsToCurrency(
    (items ?? []).reduce(
      (total, item) => total + Math.abs(item.amount),
      0,
    ),
  );
}

function findFinancialItemByLabel(
  items: HospitableFinancialItem[] | null | undefined,
  label: string,
): HospitableFinancialItem | null {
  const normalizedLabel = label.toLowerCase();

  return (
    (items ?? []).find((item) =>
      item.label.toLowerCase().includes(normalizedLabel),
    ) ?? null
  );
}

function getGuestFullName(
  reservation: HospitableReservation,
): string | null {
  const firstName =
    reservation.guest?.first_name?.trim() ?? "";

  const lastName =
    reservation.guest?.last_name?.trim() ?? "";

  const fullName = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || null;
}

function getGuestPhone(
  reservation: HospitableReservation,
): string | null {
  const phoneNumbers =
    reservation.guest?.phone_numbers;

  if (Array.isArray(phoneNumbers)) {
    return (
      phoneNumbers
        .map((phone) => phone.trim())
        .find(Boolean) ?? null
    );
  }

  if (typeof phoneNumbers === "string") {
    return phoneNumbers.trim() || null;
  }

  return null;
}

function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

function mapReservationStatus(
  reservation: HospitableReservation,
): MappedBookingStatus {
  const status =
    reservation.status.toLowerCase();

  const category =
    reservation.reservation_status?.current.category
      ?.toLowerCase() ?? "";

  const combinedStatus = `${status} ${category}`;

  if (
    combinedStatus.includes("cancel") ||
    combinedStatus.includes("declin") ||
    combinedStatus.includes("rejected")
  ) {
    return "cancelled";
  }

  if (
    combinedStatus.includes("inquiry") ||
    combinedStatus.includes("request") ||
    combinedStatus.includes("pending")
  ) {
    return "pending";
  }

  const departureDate = toDateOnly(
    reservation.departure_date,
  );

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  if (departureDate <= today) {
    return "completed";
  }

  return "confirmed";
}

function mapPaymentStatus(
  reservation: HospitableReservation,
  status: MappedBookingStatus,
): MappedPaymentStatus {
  if (status === "cancelled") {
    const guestPayments =
      reservation.financials?.guest?.payments ?? [];

    const refunded = guestPayments.some(
      (payment) =>
        payment.amount < 0 ||
        payment.label.toLowerCase().includes("refund"),
    );

    return refunded ? "refunded" : "unpaid";
  }

  const guestPayments =
    reservation.financials?.guest?.payments ?? [];

  if (
    guestPayments.some((payment) =>
      payment.label.toLowerCase().includes("failed"),
    )
  ) {
    return "failed";
  }

  if (
    guestPayments.some((payment) =>
      payment.label.toLowerCase().includes("authorized"),
    )
  ) {
    return "authorized";
  }

  const totalPrice =
    reservation.financials?.guest?.total_price?.amount ?? 0;

  const totalPayments = guestPayments.reduce(
    (total, payment) =>
      total + Math.max(payment.amount, 0),
    0,
  );

  if (
    totalPayments > 0 &&
    totalPayments >= totalPrice
  ) {
    return "paid";
  }

  /*
   * OTA reservations often do not expose payment transactions
   * through Hospitable even when the platform handles payment.
   * Accepted guest stays with a positive total are treated as paid
   * unless explicit payment evidence says otherwise.
   */
  if (
    status === "confirmed" ||
    status === "completed"
  ) {
    if (totalPrice > 0) {
      return "paid";
    }
  }

  return "unpaid";
}

function normalizeSource(platform: string): string {
  switch (platform.toLowerCase()) {
    case "airbnb":
      return "Airbnb";
    case "booking":
    case "booking.com":
      return "Booking.com";
    case "vrbo":
    case "vrbo-official":
    case "gvr":
      return "Vrbo";
    case "direct":
      return "Direct";
    case "manual":
      return "Manual";
    default:
      return platform || "Unknown";
  }
}

function getExternalPropertyId(
  reservation: HospitableReservation,
): string {
  const externalPropertyId =
    reservation.properties?.[0]?.id;

  if (!externalPropertyId) {
    throw new Error(
      `Hospitable reservation "${reservation.id}" does not include a property ID.`,
    );
  }

  return externalPropertyId;
}

export function mapHospitableReservation({
  reservation,
  localPropertyId,
  syncedAt = new Date().toISOString(),
}: {
  reservation: HospitableReservation;
  localPropertyId: string;
  syncedAt?: string;
}): HospitableReservationMapping {
  const externalPropertyId =
    getExternalPropertyId(reservation);

  const status =
    mapReservationStatus(reservation);

  const paymentStatus =
    mapPaymentStatus(reservation, status);

  const nights =
    reservation.nights > 0
      ? reservation.nights
      : 1;

  const hostAccommodation =
    centsToCurrency(
      reservation.financials?.host
        ?.accommodation?.amount,
    );

  const guestAccommodation =
    centsToCurrency(
      reservation.financials?.guest
        ?.accommodation?.amount,
    );

  const nightlyRateSource =
    hostAccommodation > 0
      ? hostAccommodation
      : guestAccommodation;

  const nightlyRate =
    Math.round(
      (nightlyRateSource / nights) * 100,
    ) / 100;

  const cleaningFeeItem =
    findFinancialItemByLabel(
      reservation.financials?.host
        ?.guest_fees,
      "cleaning",
    ) ??
    findFinancialItemByLabel(
      reservation.financials?.guest?.fees,
      "cleaning",
    );

  const cleaningFee =
    centsToCurrency(
      cleaningFeeItem?.amount,
    );

  const taxes =
    sumFinancialItems(
      reservation.financials?.guest?.taxes,
    );

  const hostServiceFee =
    sumAbsoluteFinancialItems(
      reservation.financials?.host
        ?.host_fees,
    );

  const discountAmount =
    sumAbsoluteFinancialItems(
      reservation.financials?.host
        ?.discounts,
    );

  const totalAmount =
    centsToCurrency(
      reservation.financials?.guest
        ?.total_price?.amount,
    );

  const hostRevenue =
    centsToCurrency(
      reservation.financials?.host
        ?.revenue?.amount,
    );

  return {
    externalPropertyId,
    booking: {
      property_id: localPropertyId,
      guest_id: null,
      guest_full_name:
        getGuestFullName(reservation),
      guest_email:
        reservation.guest?.email?.trim() ||
        null,
      guest_phone:
        getGuestPhone(reservation),
      check_in: toDateOnly(
        reservation.arrival_date,
      ),
      check_out: toDateOnly(
        reservation.departure_date,
      ),
      guests:
        reservation.guests.total ?? 0,
      nightly_rate: nightlyRate,
      cleaning_fee: cleaningFee,
      taxes,
      service_fee: hostServiceFee,
      total_amount: totalAmount,
      status,
      payment_status: paymentStatus,
      stripe_payment_intent_id: null,
      source: normalizeSource(
        reservation.platform,
      ),
      notes:
        reservation.notes?.trim() || null,
      external_provider: "hospitable",
      external_reservation_id:
        reservation.id,
      external_property_id:
        externalPropertyId,
      external_platform:
        reservation.platform,
      booking_code:
        reservation.code,
      external_guest_id:
        reservation.guest?.id ?? null,
      currency:
        reservation.financials
          ?.currency ?? null,
      host_revenue: hostRevenue,
      host_service_fee:
        hostServiceFee,
      discount_amount:
        discountAmount,
      last_synced_at: syncedAt,
      raw_payload: reservation,
    },
  };
}

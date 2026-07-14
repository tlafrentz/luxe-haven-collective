import type {
  BookingActivity,
} from "@/features/analytics";

import type {
  PortfolioChange,
} from "../domain";

function getGuestLabel(
  guestFullName: string | null,
): string {
  const normalizedName =
    guestFullName?.trim();

  return normalizedName || "A guest";
}

export function buildDailyBookingChanges(
  activity: BookingActivity,
): PortfolioChange[] {
  const changes: PortfolioChange[] = [];

  for (const booking of activity.createdToday) {
    changes.push({
      id: `booking-created-${booking.id}`,
      type: "booking-created",
      tone: "positive",
      pillar: "revenue",
      propertyId: booking.propertyId,
      title: "New reservation created",
      description: `${getGuestLabel(
        booking.guestFullName,
      )} booked ${booking.checkIn} through ${booking.checkOut}.`,
      occurredAt: booking.createdAt,
      value: booking.totalAmount,
      unit: "currency",
      currency: "USD",
    });
  }

  for (const booking of activity.arrivingToday) {
    changes.push({
      id: `guest-arriving-${booking.id}`,
      type: "guest-arriving",
      tone: "informational",
      pillar: "operations",
      propertyId: booking.propertyId,
      title: "Guest arriving today",
      description: `${getGuestLabel(
        booking.guestFullName,
      )} is scheduled to check in today.`,
      occurredAt: activity.generatedAt,
    });
  }

  for (const booking of activity.departingToday) {
    changes.push({
      id: `guest-departing-${booking.id}`,
      type: "guest-departing",
      tone: "informational",
      pillar: "operations",
      propertyId: booking.propertyId,
      title: "Guest departing today",
      description: `${getGuestLabel(
        booking.guestFullName,
      )} is scheduled to check out today.`,
      occurredAt: activity.generatedAt,
    });
  }

  return changes.sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() -
      new Date(left.occurredAt).getTime(),
  );
}

export const REVENUE_OBSERVATION_CAPABILITY =
  "revenue-intelligence";

export const REVENUE_OBSERVATION_TYPES = {
  grossRevenue: "revenue.gross-revenue",
  roomRevenue: "revenue.room-revenue",
  averageDailyRate: "revenue.average-daily-rate",
  revenuePerAvailableRoom:
    "revenue.revenue-per-available-room",
  occupiedNights: "revenue.occupied-nights",
  availableNights: "revenue.available-nights",
  occupancyRate: "revenue.occupancy-rate",
  totalBookings: "revenue.total-bookings",
  upcomingBookings: "revenue.upcoming-bookings",
  completedBookings: "revenue.completed-bookings",
  cancelledBookings: "revenue.cancelled-bookings",
  cancellationRate: "revenue.cancellation-rate",
  averageBookingLeadTime:
    "revenue.average-booking-lead-time",
  averageLengthOfStay:
    "revenue.average-length-of-stay",
  opportunityEvidence:
    "revenue.opportunity-evidence",
} as const;

export type RevenueObservationType =
  (typeof REVENUE_OBSERVATION_TYPES)[
    keyof typeof REVENUE_OBSERVATION_TYPES
  ];

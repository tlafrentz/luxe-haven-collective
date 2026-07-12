import type {
  HospitablePaginatedResponse,
  HospitableProperty,
} from "./hospitable";

export type HospitableMoney = {
  amount: number;
  formatted: string;
  label: string;
  category: string;
};

export type HospitableFinancialItem = HospitableMoney;

export type HospitableAccommodationBreakdownItem = {
  amount: number;
  formatted: string;
  label: string;
  category: string;
};

export type HospitableGuestFinancials = {
  accommodation: HospitableMoney | null;
  average_nightly_rate: HospitableMoney | null;
  fees: HospitableFinancialItem[];
  discounts: HospitableFinancialItem[];
  taxes: HospitableFinancialItem[];
  adjustments: HospitableFinancialItem[];
  payments: HospitableFinancialItem[];
  total_price: HospitableMoney | null;
};

export type HospitableHostFinancials = {
  accommodation: HospitableMoney | null;
  accommodation_breakdown: HospitableAccommodationBreakdownItem[];
  guest_fees: HospitableFinancialItem[];
  host_fees: HospitableFinancialItem[];
  discounts: HospitableFinancialItem[];
  adjustments: HospitableFinancialItem[];
  taxes: HospitableFinancialItem[];
  revenue: HospitableMoney | null;
};

export type HospitableReservationFinancials = {
  currency: string | null;
  guest: HospitableGuestFinancials | null;
  host: HospitableHostFinancials | null;
};

export type HospitableReservationGuestCounts = {
  total: number;
  adult_count: number;
  child_count: number;
  infant_count: number;
  pet_count: number;
};

export type HospitableReservationGuest = {
  id: string;
  location: string | null;
  profile_picture: string | null;
  email: string | null;
  phone_numbers: string[] | string | null;
  first_name: string | null;
  last_name: string | null;
  language: string | null;
};

export type HospitableReservationListing = {
  platform: string;
  platform_id: string;
  platform_user_id: string | null;
  platform_picture: string | null;
  co_hosts: unknown[];
  platform_name: string | null;
  platform_email: string | null;
};

export type HospitableReservationStatusValue = {
  category: string;
  sub_category: string | null;
};

export type HospitableReservationStatusHistoryItem = {
  category: string;
  sub_category: string | null;
  changed_at: string;
};

export type HospitableReservationStatus = {
  current: HospitableReservationStatusValue;
  history: HospitableReservationStatusHistoryItem[];
};

export type HospitableStatusHistoryItem = {
  category: string;
  status: string;
  changed_at: string;
};

export type HospitableReservation = {
  id: string;
  code: string | null;
  platform: string;
  platform_id: string | null;
  booking_date: string | null;
  arrival_date: string;
  departure_date: string;
  check_in: string | null;
  check_out: string | null;
  nights: number;
  stay_type: string | null;
  owner_stay: unknown | null;
  reservation_status: HospitableReservationStatus | null;
  conversation_id: string | null;
  conversation_language: string | null;
  last_message_at: string | null;
  notes: string | null;
  guests: HospitableReservationGuestCounts;
  financials?: HospitableReservationFinancials | null;
  properties?: HospitableProperty[];
  listings?: HospitableReservationListing[];
  guest?: HospitableReservationGuest | null;
  issue_alert: unknown | null;
  status: string;
  status_history: HospitableStatusHistoryItem[];
};

export type HospitableReservationsResponse =
  HospitablePaginatedResponse<HospitableReservation>;

export type HospitableReservationDetailResponse = {
  data: HospitableReservation;
};

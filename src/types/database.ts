// ======================================================
// Luxe Haven Collective
// Shared Database Types
// ======================================================

export type UserRole =
  | "guest"
  | "owner"
  | "admin"
  | "cleaner";

export type PropertyStatus =
  | "draft"
  | "active"
  | "paused"
  | "archived";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "completed";

export type ContactInquiryStatus =
  | "new"
  | "reviewed"
  | "responded"
  | "closed";

// ======================================================
// Profiles
// ======================================================

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
};

// ======================================================
// Properties
// ======================================================

export type Property = {
  id: string;

  owner_id: string | null;

  name: string;
  slug: string;

  headline: string | null;
  short_description: string | null;
  description: string;

  property_type: string | null;

  address_line_1: string | null;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string | null;

  latitude: number | null;
  longitude: number | null;

  neighborhood: string | null;

  bedrooms: number;
  bathrooms: number;
  beds: number | null;
  max_guests: number;

  nightly_rate: number;
  cleaning_fee: number;
  security_deposit: number | null;
  service_fee: number | null;
  tax_rate: number | null;
  minimum_nights: number;

  check_in_time: string;
  check_out_time: string;

  amenities: string[];
  highlights: string[];

  house_rules: string[];

  image_urls: string[];
  featured_image_url: string | null;

  seo_title: string | null;
  seo_description: string | null;

  status: PropertyStatus;
  is_featured: boolean;

  metadata: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;
  published_at: string | null;
};

// ======================================================
// Bookings
// ======================================================

export type Booking = {
  id: string;

  property_id: string;
  guest_id: string | null;

  check_in: string;
  check_out: string;

  guests: number;

  total_amount: number;

  status: BookingStatus;
};

// ======================================================
// Contact Inquiries
// ======================================================

export type ContactInquiry = {
  id: string;

  name: string;
  email: string;
  phone: string | null;

  inquiry_type: string;
  property_market: string | null;

  message: string;

  source: string;

  status: ContactInquiryStatus;

  created_at: string;
};

// ======================================================
// Lead Magnet Downloads
// ======================================================

export type LeadMagnetDownload = {
  id: string;

  name: string;
  email: string;

  property_market: string;
  property_status: string;

  lead_magnet: string;

  created_at: string;
};

// ======================================================
// Property Media
// ======================================================

export type PropertyMedia = {
  id: string;

  property_id: string;

  storage_path: string | null;

  url: string;

  alt_text: string | null;

  sort_order: number;

  is_featured: boolean;

  created_at: string;
};

// ======================================================
// LHS-001 v2.0: Mesa Direct Booking Request Pilot
// ======================================================
// See src/features/booking-requests/domain for the canonical
// BookingRequestStatus lifecycle type. checkout_attempts (v1) was renamed
// and extended into booking_requests (v2) — see
// supabase/migrations/20260918100000_lhs001v2_request_to_book.sql.

export type BookingRequest = {
  id: string;

  request_token: string;

  property_id: string;
  external_property_id: string | null;

  arrival: string | null;
  departure: string | null;
  guest_count: number | null;
  adults: number | null;
  children: number;
  pets: number;

  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "alternate_proposed"
    | "approved"
    | "awaiting_payment"
    | "confirmed"
    | "payment_failed"
    | "declined"
    | "withdrawn"
    | "expired";

  owner_id: string | null;
  sla_due_at: string | null;
  withdrawn_at: string | null;

  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referral_id: string | null;

  created_at: string;
  updated_at: string;
  expires_at: string;
};

export type HospitableReservationEventStatus =
  | "received"
  | "processed"
  | "duplicate"
  | "unresolved"
  | "ignored"
  | "failed";

export type HospitableReservationEvent = {
  id: string;

  environment: "test" | "live";
  provider_event_id: string;
  provider_event_type: string;
  provider_created_at: string | null;

  status: HospitableReservationEventStatus;

  related_property_id: string | null;
  related_reservation_external_id: string | null;

  normalized_event: Record<string, unknown>;

  received_at: string;
  processed_at: string | null;

  last_error_code: string | null;
  last_error_message: string | null;
};

export type BookingExceptionStatus = "open" | "reviewing" | "resolved";

export type BookingException = {
  id: string;

  reservation_external_id: string | null;
  property_id: string | null;

  issue_type: string;
  detected_at: string;

  provider_evidence: Record<string, unknown>;

  status: BookingExceptionStatus;
  next_action: string | null;
  owner_id: string | null;

  resolution_notes: string | null;
  resolved_at: string | null;

  created_at: string;
  updated_at: string;
};
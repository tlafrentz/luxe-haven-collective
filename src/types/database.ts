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
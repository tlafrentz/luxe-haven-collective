export type UserRole = "guest" | "owner" | "admin" | "cleaner";
export type PropertyStatus = "draft" | "active" | "paused" | "archived";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
};

export type Property = {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  headline: string | null;
  short_description: string | null;
  description: string;
  property_type: string;
  address?: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  nightly_rate: number;
  cleaning_fee: number;
  service_fee: number;
  tax_rate: number;
  minimum_nights: number;
  check_in_time: string;
  check_out_time: string;
  amenities: string[];
  highlights: string[];
  house_rules: string[];
  images: string[];
  featured_image: string | null;
  seo_title: string | null;
  seo_description: string | null;
  status: PropertyStatus;
  created_at?: string;
  updated_at?: string;
  published_at?: string | null;
};

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

export type ContactInquiryStatus = "new" | "reviewed" | "responded" | "closed";

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

export type LeadMagnetDownload = {
  id: string;
  name: string;
  email: string;
  property_market: string;
  property_status: string;
  lead_magnet: string;
  created_at: string;
};


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

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
  description: string;
  address?: string | null;
  city: string;
  state: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  nightly_rate: number;
  amenities: string[];
  images: string[];
  status: PropertyStatus;
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

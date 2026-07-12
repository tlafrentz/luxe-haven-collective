export type HospitablePaginatedResponse<T> = {
  data: T[];
  links: HospitablePaginationLinks;
  meta: HospitablePaginationMeta;
};

export type HospitablePaginationLinks = {
  first?: string | null;
  last?: string | null;
  previous?: string | null;
  next?: string | null;
};

export type HospitablePaginationMeta = {
  current_page?: number;
  from?: number | null;
  last_page?: number;
  path?: string;
  per_page?: number;
  to?: number | null;
  total?: number;
  [key: string]: unknown;
};

export type HospitableCoordinates = {
  latitude: string | null;
  longitude: string | null;
};

export type HospitableAddress = {
  number: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  country_name: string | null;
  coordinates: HospitableCoordinates | null;
  display: string | null;
};

export type HospitableCapacity = {
  max: number | null;
  bedrooms: number | null;
  beds: number | null;
  bathrooms: number | null;
};

export type HospitableBed = {
  type: string;
  quantity: number;
};

export type HospitableRoomDetail = {
  type: string;
  beds: HospitableBed[];
};

export type HospitableHouseRules = {
  pets_allowed: boolean;
  smoking_allowed: boolean;
  events_allowed: boolean;
};

export type HospitableProperty = {
  id: string;
  name: string;
  public_name: string | null;
  picture: string | null;
  address: HospitableAddress | null;
  timezone: string | null;
  listed: boolean;
  currency: string | null;
  summary: string | null;
  description: string | null;
  checkin: string | null;
  checkout: string | null;
  amenities: string[];
  capacity: HospitableCapacity | null;
  room_details: HospitableRoomDetail[];
  property_type: string | null;
  room_type: string | null;
  tags: string[];
  house_rules: HospitableHouseRules | null;
  calendar_restricted: boolean;
  parent_child: unknown | null;
};

export type HospitablePropertiesResponse =
  HospitablePaginatedResponse<HospitableProperty>;

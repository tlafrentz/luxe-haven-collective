export type CurrencyCode = string;
export type Money = Readonly<{ amountMinor: number; currency: CurrencyCode }>;

export const FURNISHING_PROJECT_LIFECYCLE = [
  "draft",
  "planning",
  "designing",
  "awaiting_approval",
  "approved",
  "procuring",
  "installing",
  "launch_review",
  "completed",
  "cancelled",
  "archived",
] as const;
export const FURNISHING_PROJECT_TYPES = [
  "full_property",
  "partial_property",
  "refresh",
  "replacement",
] as const;
export const FURNISHING_ROOM_TYPES = [
  "living_room",
  "bedroom",
  "primary_bedroom",
  "kitchen",
  "dining_room",
  "bathroom",
  "office",
  "outdoor",
  "entry",
  "laundry",
  "garage",
  "other",
] as const;
export const QUANTITY_RULE_TYPES = [
  "fixed",
  "per_bedroom",
  "per_bathroom",
  "per_guest",
  "per_room",
  "per_bed",
  "custom",
] as const;

export type FurnishingProjectLifecycle =
  (typeof FURNISHING_PROJECT_LIFECYCLE)[number];
export type FurnishingProjectType = (typeof FURNISHING_PROJECT_TYPES)[number];
export type FurnishingRoomType = (typeof FURNISHING_ROOM_TYPES)[number];
export type QuantityRuleType = (typeof QUANTITY_RULE_TYPES)[number];

export type FurnishingProject = Readonly<{
  id: string;
  workspaceId: string;
  propertyId: string;
  name: string;
  description: string | null;
  lifecycleStatus: FurnishingProjectLifecycle;
  projectType: FurnishingProjectType;
  targetBudget: Money | null;
  targetLaunchDate: string | null;
  currentPlanVersionId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}>;

export type PropertyFurnishingProfile = Readonly<{
  id: string;
  propertyId: string;
  bedroomCount: number | null;
  bathroomCount: number | null;
  guestCapacity: number | null;
  squareFeet: number | null;
  propertyType: string | null;
  furnishingState:
    | "empty"
    | "partially_furnished"
    | "furnished"
    | "refresh_needed"
    | "unknown";
  stylePreferenceId: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type FurnishingRoom = Readonly<{
  id: string;
  projectId: string;
  roomType: FurnishingRoomType;
  name: string;
  ordinal: number | null;
  status:
    | "not_started"
    | "planning"
    | "selected"
    | "approved"
    | "ordered"
    | "delivered"
    | "installed"
    | "complete";
  targetBudget: Money | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}>;

export type FurnishingProduct = Readonly<{
  id: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  productType: string;
  category: string;
  subcategory: string | null;
  brand: string | null;
  manufacturerPartNumber: string | null;
  defaultMediaAssetId: string | null;
  status: "draft" | "approved" | "discontinued" | "archived";
  scope: "platform" | "workspace";
  tags: readonly string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}>;

export type ProductOffer = Readonly<{
  id: string;
  productId: string;
  retailerId: string;
  retailerProductId: string | null;
  sku: string | null;
  productUrl: string;
  listedPrice: Money | null;
  shippingPrice: Money | null;
  availability: "in_stock" | "low_stock" | "out_of_stock" | "unknown";
  affiliateUrl: string | null;
  lastVerifiedAt: string | null;
  status: "active" | "unavailable" | "discontinued" | "archived";
  createdAt: string;
  updatedAt: string;
}>;

export type QuantityRule = Readonly<{
  id: string;
  ruleType: QuantityRuleType;
  multiplier: number;
  minimum: number | null;
  maximum: number | null;
  customExpression: string | null;
  rounding: "none" | "up" | "down" | "nearest";
}>;

export type QuantityFacts = Readonly<{
  bedrooms: number;
  bathrooms: number;
  guests: number;
  rooms: number;
  beds: number;
}>;

export type ProductSelection = Readonly<{
  id: string;
  furnishingPlanId: string;
  roomId: string;
  packageItemId: string | null;
  productId: string;
  selectedOfferId: string | null;
  quantityRuleId: string | null;
  resolvedQuantity: number;
  estimatedUnitPrice: Money | null;
  estimatedTotal: Money | null;
  priceObservedAt: string | null;
  selectionSource: "package" | "manual" | "substitution" | "existing_inventory";
  selectionStatus:
    | "recommended"
    | "selected"
    | "approved"
    | "rejected"
    | "replaced";
  required: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export function money(amountMinor: number, currency = "USD"): Money {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor < 0 ||
    !/^[A-Z]{3}$/.test(currency)
  )
    throw new Error("FURNISHING_MONEY_INVALID");
  return Object.freeze({ amountMinor, currency });
}

export function multiplyMoney(value: Money, quantity: number): Money {
  if (!Number.isFinite(quantity) || quantity < 0)
    throw new Error("FURNISHING_QUANTITY_INVALID");
  return money(Math.round(value.amountMinor * quantity), value.currency);
}

export function resolveQuantity(
  rule: QuantityRule,
  facts: QuantityFacts,
): number {
  if (rule.ruleType === "custom")
    throw new Error("FURNISHING_CUSTOM_RULE_UNAVAILABLE");
  const basis = {
    fixed: 1,
    per_bedroom: facts.bedrooms,
    per_bathroom: facts.bathrooms,
    per_guest: facts.guests,
    per_room: facts.rooms,
    per_bed: facts.beds,
  }[rule.ruleType];
  let result = basis * rule.multiplier;
  if (rule.minimum !== null) result = Math.max(result, rule.minimum);
  if (rule.maximum !== null) result = Math.min(result, rule.maximum);
  if (rule.rounding === "up") result = Math.ceil(result);
  if (rule.rounding === "down") result = Math.floor(result);
  if (rule.rounding === "nearest") result = Math.round(result);
  if (!Number.isFinite(result) || result < 0)
    throw new Error("FURNISHING_QUANTITY_INVALID");
  return result;
}

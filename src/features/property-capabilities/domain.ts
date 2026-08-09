export const propertyCapabilities = [
  "guidebook",
  "hpm",
  "furnishing",
  "investment",
] as const;

export type PropertyCapability = (typeof propertyCapabilities)[number];
export type PropertyCapabilityStatus =
  | "pending"
  | "enabled"
  | "suspended"
  | "disabled";

export type GuidebookPropertyInput = Readonly<{
  workspaceId: string;
  name: string;
  propertyType: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  maxGuests: number;
  address?: string;
  postalCode?: string;
  bedrooms?: number;
  bathrooms?: number;
}>;

export type CapabilityProperty = Readonly<{
  id: string;
  capabilities: readonly Readonly<{
    capability: PropertyCapability;
    status: PropertyCapabilityStatus;
  }>[];
}>;

const IANA_TIMEZONE = /^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)+$/;

export function validateGuidebookPropertyInput(input: GuidebookPropertyInput) {
  const errors: string[] = [];
  const requiredText = [
    ["workspaceId", input.workspaceId],
    ["name", input.name],
    ["propertyType", input.propertyType],
    ["city", input.city],
    ["state", input.state],
    ["country", input.country],
    ["timezone", input.timezone],
  ] as const;
  for (const [field, value] of requiredText) {
    if (!value.trim()) errors.push(field);
  }
  if (!Number.isInteger(input.maxGuests) || input.maxGuests < 1)
    errors.push("maxGuests");
  if (!IANA_TIMEZONE.test(input.timezone)) errors.push("timezone");
  if (input.bedrooms != null && (!Number.isInteger(input.bedrooms) || input.bedrooms < 0))
    errors.push("bedrooms");
  if (input.bathrooms != null && (!Number.isFinite(input.bathrooms) || input.bathrooms < 0))
    errors.push("bathrooms");
  return { valid: errors.length === 0, fields: [...new Set(errors)] } as const;
}

export function hasEnabledCapability(
  property: CapabilityProperty,
  capability: PropertyCapability,
) {
  return property.capabilities.some(
    (item) => item.capability === capability && item.status === "enabled",
  );
}

export function scopePropertiesByCapability(
  properties: readonly CapabilityProperty[],
  capability: PropertyCapability,
) {
  return properties.filter((property) => hasEnabledCapability(property, capability));
}

export function listGuidebookEligibleProperties(
  properties: readonly CapabilityProperty[],
) {
  return properties.filter(
    (property) =>
      hasEnabledCapability(property, "guidebook") ||
      hasEnabledCapability(property, "hpm"),
  );
}

export function calculateGuidebookCoverage(
  properties: readonly CapabilityProperty[],
  publishedPropertyIds: ReadonlySet<string>,
) {
  const eligible = scopePropertiesByCapability(properties, "guidebook");
  const published = eligible.filter((property) => publishedPropertyIds.has(property.id)).length;
  return {
    eligible: eligible.length,
    published,
    percentage: eligible.length === 0 ? 0 : Math.round((published / eligible.length) * 100),
  } as const;
}

export function evaluateHpmUpgrade(property: CapabilityProperty) {
  return hasEnabledCapability(property, "hpm")
    ? { eligible: false, reason: "already-enabled" as const }
    : { eligible: true, reason: "available" as const };
}

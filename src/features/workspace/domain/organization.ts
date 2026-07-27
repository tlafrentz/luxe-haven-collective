export type OrganizationAddress = Readonly<{
  line1?: string;
  line2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}>;

export type OrganizationCompletenessStatus =
  | "complete"
  | "needs-attention"
  | "incomplete";

export type OrganizationCompleteness = Readonly<{
  status: OrganizationCompletenessStatus;
  missingRequired: readonly string[];
  missingRecommended: readonly string[];
  dimensions: Readonly<{
    identity: boolean;
    contact: boolean;
    regionalDefaults: boolean;
    brand: boolean;
  }>;
}>;

export type OrganizationProfile = Readonly<{
  workspaceId: string;
  ownerId: string;
  profileId: string;
  displayName: string;
  legalName?: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  businessEmail?: string;
  businessPhone?: string;
  address?: OrganizationAddress;
  preferredContactMethod?: string;
  timezone: string;
  currency: string;
  language: string;
  country: string;
  confirmedFields: readonly string[];
  completeness: OrganizationCompleteness;
  revision: number;
  updatedAt: string;
}>;

export type OrganizationDefaults = Readonly<{
  workspaceId: string;
  displayName: string;
  timezone: string;
  currency: string;
  language: string;
  country: string;
  source: "organization";
}>;

export type OrganizationUpdate = Readonly<{
  displayName: string;
  legalName?: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  businessEmail?: string;
  businessPhone?: string;
  address?: OrganizationAddress;
  preferredContactMethod?: string;
  timezone: string;
  currency: string;
  language: string;
  country: string;
}>;

export const organizationFieldLabels = Object.freeze({
  displayName: "Display name",
  timezone: "Timezone",
  currency: "Currency",
  language: "Language",
  country: "Country",
  website: "Website",
  businessEmail: "Business email",
  address: "Mailing address",
  logoUrl: "Logo",
  description: "Description",
});

const requiredFields = [
  "displayName",
  "timezone",
  "currency",
  "language",
  "country",
] as const;

export function evaluateOrganizationCompleteness(input: Readonly<{
  profile: Omit<OrganizationProfile, "completeness">;
}>): OrganizationCompleteness {
  const profile = input.profile;
  const confirmed = new Set(profile.confirmedFields);
  const missingRequired = requiredFields
    .filter((field) => !profile[field] || !confirmed.has(field))
    .map((field) => organizationFieldLabels[field]);
  const missingRecommended: string[] = [];
  if (!profile.businessEmail) missingRecommended.push(organizationFieldLabels.businessEmail);
  if (!profile.website) missingRecommended.push(organizationFieldLabels.website);
  if (!profile.address) missingRecommended.push(organizationFieldLabels.address);
  if (!profile.logoUrl) missingRecommended.push(organizationFieldLabels.logoUrl);
  if (!profile.description) missingRecommended.push(organizationFieldLabels.description);
  return Object.freeze({
    status: missingRequired.length
      ? confirmed.size === 0
        ? "incomplete"
        : "needs-attention"
      : "complete",
    missingRequired,
    missingRecommended,
    dimensions: {
      identity: Boolean(profile.displayName && confirmed.has("displayName")),
      contact: Boolean(profile.businessEmail || profile.businessPhone || profile.address),
      regionalDefaults: ["timezone", "currency", "language", "country"].every(
        (field) => confirmed.has(field),
      ),
      brand: Boolean(profile.logoUrl || profile.description || profile.website),
    },
  });
}

export function getOrganizationDefaults(
  profile: OrganizationProfile,
): OrganizationDefaults {
  return Object.freeze({
    workspaceId: profile.workspaceId,
    displayName: profile.displayName,
    timezone: profile.timezone,
    currency: profile.currency,
    language: profile.language,
    country: profile.country,
    source: "organization",
  });
}

export class OrganizationValidationError extends Error {
  constructor(
    readonly fieldErrors: Readonly<Record<string, string>>,
    message = "Review the highlighted organization fields.",
  ) {
    super(message);
    this.name = "OrganizationValidationError";
  }
}

export class OrganizationConcurrencyError extends Error {
  constructor() {
    super("Organization settings changed in another session. Refresh and review the latest values.");
    this.name = "OrganizationConcurrencyError";
  }
}

export enum ProviderType {
  Unknown = "unknown",

  AirDna = "airdna",
  PriceLabs = "pricelabs",
  RentCast = "rentcast",
  ATTOM = "attom",
  Zillow = "zillow",
  Realtor = "realtor",
  MLS = "mls",

  Airbnb = "airbnb",
  Vrbo = "vrbo",
  Hospitable = "hospitable",

  GooglePlaces = "google-places",
  GoogleMaps = "google-maps",

  CountyAssessor = "county-assessor",
  MortgageProvider = "mortgage-provider",
  InsuranceProvider = "insurance-provider",

  Internal = "internal",
  Manual = "manual",
}

const PROVIDER_DISPLAY_NAMES: Readonly<
  Record<ProviderType, string>
> = {
  [ProviderType.Unknown]:
    "Unknown",
  [ProviderType.AirDna]:
    "AirDNA",
  [ProviderType.PriceLabs]:
    "PriceLabs",
  [ProviderType.RentCast]:
    "RentCast",
  [ProviderType.ATTOM]:
    "ATTOM",
  [ProviderType.Zillow]:
    "Zillow",
  [ProviderType.Realtor]:
    "Realtor",
  [ProviderType.MLS]:
    "MLS",
  [ProviderType.Airbnb]:
    "Airbnb",
  [ProviderType.Vrbo]:
    "Vrbo",
  [ProviderType.Hospitable]:
    "Hospitable",
  [ProviderType.GooglePlaces]:
    "Google Places",
  [ProviderType.GoogleMaps]:
    "Google Maps",
  [ProviderType.CountyAssessor]:
    "County Assessor",
  [ProviderType.MortgageProvider]:
    "Mortgage Provider",
  [ProviderType.InsuranceProvider]:
    "Insurance Provider",
  [ProviderType.Internal]:
    "Internal",
  [ProviderType.Manual]:
    "Manual",
};

export function getProviderDisplayName(
  providerType: ProviderType,
): string {
  return PROVIDER_DISPLAY_NAMES[
    providerType
  ];
}

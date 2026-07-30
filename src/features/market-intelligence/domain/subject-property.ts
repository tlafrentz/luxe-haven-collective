export const SUBJECT_PROPERTY_SCHEMA_VERSION = "subject-property.v1";
export const REALTY_API_MAPPING_VERSION = "realtyapi-realtor-property.v1";

export interface PropertyFieldLineage {
  readonly provider: "realtyapi";
  readonly retrievedAt: Date;
  readonly snapshotId: string;
  readonly sourceEndpoint: string;
}

export interface SourcedPropertyField<T> {
  readonly value: T | null;
  readonly lineage: PropertyFieldLineage;
}

export interface SubjectPropertyAddress {
  readonly formatted: SourcedPropertyField<string>;
  readonly street: SourcedPropertyField<string>;
  readonly city: SourcedPropertyField<string>;
  readonly state: SourcedPropertyField<string>;
  readonly postalCode: SourcedPropertyField<string>;
  readonly county: SourcedPropertyField<string>;
  readonly latitude: SourcedPropertyField<number>;
  readonly longitude: SourcedPropertyField<number>;
}

export interface SubjectPropertyPhysical {
  readonly propertyType: SourcedPropertyField<string>;
  readonly bedrooms: SourcedPropertyField<number>;
  readonly bathrooms: SourcedPropertyField<number>;
  readonly livingAreaSquareFeet: SourcedPropertyField<number>;
  readonly lotSizeSquareFeet: SourcedPropertyField<number>;
  readonly yearBuilt: SourcedPropertyField<number>;
}

export interface SubjectPropertyListing {
  readonly status: SourcedPropertyField<string>;
  readonly listPrice: SourcedPropertyField<number>;
  readonly lastSalePrice: SourcedPropertyField<number>;
  readonly lastSaleDate: SourcedPropertyField<string>;
}

export interface SubjectPropertyConfidence {
  readonly score: number;
  readonly level: "high" | "medium" | "low";
  readonly reasons: readonly string[];
  readonly completeness: number;
  readonly addressMatch: "exact" | "normalized";
}

export interface SubjectProperty {
  readonly id: string;
  readonly providerPropertyId: string;
  readonly provider: "realtyapi";
  readonly address: SubjectPropertyAddress;
  readonly physical: SubjectPropertyPhysical;
  readonly listing: SubjectPropertyListing;
  readonly retrievedAt: Date;
  readonly snapshotId: string;
  readonly snapshotVersion: number;
  readonly schemaVersion: typeof SUBJECT_PROPERTY_SCHEMA_VERSION;
  readonly providerVersion: string;
  readonly sourceEndpoint: string;
  readonly confidence: SubjectPropertyConfidence;
  readonly missingFields: readonly string[];
}

export interface PropertyLookupCandidate {
  readonly providerPropertyId: string;
  readonly listingId?: string;
  readonly formattedAddress: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface PropertySnapshot {
  readonly id: string;
  readonly ownerId: string;
  readonly workspaceId: string;
  readonly subjectPropertyId: string;
  readonly normalizedAddressKey: string;
  readonly version: number;
  readonly property: SubjectProperty;
  readonly capturedAt: Date;
  readonly listingFreshUntil: Date;
  readonly expiresAt: Date;
}

export interface PropertySnapshotRepository {
  findById(id: string, scope: PropertySnapshotScope): Promise<PropertySnapshot | null>;
  findFreshByAddress(normalizedAddressKey: string, now: Date, scope: PropertySnapshotScope): Promise<PropertySnapshot | null>;
  findLatestByAddress(normalizedAddressKey: string, scope: PropertySnapshotScope): Promise<PropertySnapshot | null>;
  nextVersion(subjectPropertyId: string, scope: PropertySnapshotScope): Promise<number>;
  save(snapshot: PropertySnapshot): Promise<void>;
}

export interface PropertySnapshotScope {
  readonly ownerId: string;
  readonly workspaceId: string;
}

export function freezeSubjectProperty<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeSubjectProperty(child);
  }
  return value;
}

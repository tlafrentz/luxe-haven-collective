import type { SubjectProperty } from "../../domain";
import type { StrMarketQuery } from "../domain";
import { DEFAULT_STR_COMPARABLE_POLICY } from "./str-market-policy";

export function buildStrMarketQuery(subject: SubjectProperty, options: {
  readonly requestedAt?: Date; readonly accommodates?: number; readonly entirePlace?: boolean;
  readonly amenities?: readonly string[]; readonly currency?: string;
} = {}): StrMarketQuery {
  const latitude = subject.address.latitude.value;
  const longitude = subject.address.longitude.value;
  if (latitude === null || longitude === null) throw new Error("Subject property coordinates are required for STR market intelligence.");
  const missingInputs: string[] = [];
  if (subject.physical.propertyType.value === null) missingInputs.push("propertyType");
  if (subject.physical.bedrooms.value === null) missingInputs.push("bedrooms");
  if (subject.physical.bathrooms.value === null) missingInputs.push("bathrooms");
  if (options.accommodates === undefined) missingInputs.push("accommodates");
  if (options.entirePlace === undefined) missingInputs.push("entirePlace");
  return {
    subjectPropertyId: subject.id, subjectPropertySnapshotId: subject.snapshotId,
    location: { latitude, longitude },
    property: {
      ...(subject.physical.propertyType.value !== null ? { propertyType: subject.physical.propertyType.value } : {}),
      ...(subject.physical.bedrooms.value !== null ? { bedrooms: subject.physical.bedrooms.value } : {}),
      ...(subject.physical.bathrooms.value !== null ? { bathrooms: subject.physical.bathrooms.value } : {}),
      ...options,
    },
    filters: {
      radiusMiles: DEFAULT_STR_COMPARABLE_POLICY.initialRadiusMiles,
      ...(subject.physical.bedrooms.value !== null ? {
        minimumBedrooms: Math.max(0, subject.physical.bedrooms.value - DEFAULT_STR_COMPARABLE_POLICY.bedroomTolerance),
        maximumBedrooms: subject.physical.bedrooms.value + DEFAULT_STR_COMPARABLE_POLICY.bedroomTolerance,
      } : {}),
      entirePlaceOnly: true, maximumComparableCount: DEFAULT_STR_COMPARABLE_POLICY.maximumComparableCount,
    },
    requestedAt: (options.requestedAt ?? new Date()).toISOString(), missingInputs,
  };
}

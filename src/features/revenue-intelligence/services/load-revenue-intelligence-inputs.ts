import {
  getAnalyticsBookings,
  getAnalyticsProperties,
  getPreviousDateRange,
  type AnalyticsBooking,
  type AnalyticsDateRange,
  type AnalyticsProperty,
  type AnalyticsQueryParams,
} from "@/features/analytics";

export type RevenueIntelligenceInputs = {
  properties: AnalyticsProperty[];
  selectedProperty: AnalyticsProperty | null;
  selectedPropertyId: string | null;
  propertyCount: number;
  dateRange: AnalyticsDateRange;
  previousDateRange: AnalyticsDateRange;
  currentBookings: AnalyticsBooking[];
  previousBookings: AnalyticsBooking[];
};

function resolveSelectedProperty({
  properties,
  propertyId,
}: {
  properties: AnalyticsProperty[];
  propertyId?: string | null;
}): AnalyticsProperty | null {
  if (!propertyId) {
    return null;
  }

  return (
    properties.find(
      (property) => property.id === propertyId,
    ) ?? null
  );
}

export async function loadRevenueIntelligenceInputs({
  propertyId,
  startDate,
  endDate,
}: AnalyticsQueryParams): Promise<RevenueIntelligenceInputs> {
  const properties =
    await getAnalyticsProperties();

  const selectedProperty =
    resolveSelectedProperty({
      properties,
      propertyId,
    });

  const selectedPropertyId =
    selectedProperty?.id ?? null;

  const propertyCount =
    selectedPropertyId === null
      ? properties.length
      : 1;

  const dateRange: AnalyticsDateRange = {
    startDate,
    endDate,
  };

  const previousDateRange =
    getPreviousDateRange(dateRange);

  const [
    currentBookings,
    previousBookings,
  ] = await Promise.all([
    getAnalyticsBookings({
      propertyId: selectedPropertyId,
      ...dateRange,
    }),
    getAnalyticsBookings({
      propertyId: selectedPropertyId,
      ...previousDateRange,
    }),
  ]);

  return {
    properties,
    selectedProperty,
    selectedPropertyId,
    propertyCount,
    dateRange,
    previousDateRange,
    currentBookings,
    previousBookings,
  };
}

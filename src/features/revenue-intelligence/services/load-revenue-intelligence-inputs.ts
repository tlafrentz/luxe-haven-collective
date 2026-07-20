import type {
  AnalyticsBooking,
  AnalyticsDateRange,
  AnalyticsProperty,
  AnalyticsQueryParams,
} from "../domain/revenue-input";
import { revenueAnalyticsGateway } from "../adapters/analytics-input-adapter";

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
    await revenueAnalyticsGateway.loadProperties();

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
    revenueAnalyticsGateway.previousDateRange(dateRange);

  const [
    currentBookings,
    previousBookings,
  ] = await Promise.all([
    revenueAnalyticsGateway.loadBookings({
      propertyId: selectedPropertyId,
      ...dateRange,
    }),
    revenueAnalyticsGateway.loadBookings({
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

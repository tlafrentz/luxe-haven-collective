import { luxeInsightsMockData } from "../mock-data"
import type { LuxeInsightsData } from "../types"
import { getActiveInsightProperties } from "../lib/queries"

export async function getInsights(): Promise<LuxeInsightsData> {
  const properties = await getActiveInsightProperties()

  const availableProperties =
    properties.length > 0
      ? properties
      : [luxeInsightsMockData.property]

  const selectedProperty =
    availableProperties.find(
      (property) =>
        property.id === luxeInsightsMockData.property.id,
    ) ?? availableProperties[0]

  return {
    ...luxeInsightsMockData,
    property: selectedProperty,
    availableProperties,
  }
}

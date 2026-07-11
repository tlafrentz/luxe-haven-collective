import { createClient } from "@/lib/supabase/server"

import type { InsightProperty } from "../types"

type PropertyRow = {
  id: string
  name: string
  city: string | null
  state: string | null
}

function formatPropertyLocation(property: PropertyRow): string {
  const locationParts = [property.city, property.state].filter(
    (value): value is string => Boolean(value),
  )

  return locationParts.length > 0
    ? locationParts.join(", ")
    : "Location not set"
}

export async function getActiveInsightProperties(): Promise<
  InsightProperty[]
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("properties")
    .select("id, name, city, state")
    .eq("status", "active")
    .order("name", { ascending: true })

  if (error) {
    throw new Error(
      `Unable to load properties for Luxe Insights: ${error.message}`,
    )
  }

  return (data ?? []).map((property) => ({
    id: property.id,
    name: property.name,
    location: formatPropertyLocation(property),
  }))
}

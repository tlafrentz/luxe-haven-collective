export type PropertyRouteContext = Readonly<Record<string, string | string[] | undefined>>;

export function getPropertyIntelligenceHref(propertyId: string, context: PropertyRouteContext = {}, returnTo = "/dashboard/understand/portfolio") {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(context)) {
    if (key === "property" || key === "returnTo" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  params.set("property", propertyId);
  params.set("returnTo", returnTo);
  return `/dashboard/understand/portfolio/properties?${params.toString()}#property-detail`;
}

export function getCanonicalPropertyHref(propertyId: string) {
  return `/dashboard/workspace/properties?property=${encodeURIComponent(propertyId)}`;
}

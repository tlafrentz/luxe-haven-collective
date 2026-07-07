import type { MetadataRoute } from "next";
import { getPublishedProperties } from "@/lib/properties";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://luxehavencollective.com";
  const properties = await getPublishedProperties();
  const staticRoutes = ["", "/stays", "/services", "/owners", "/about", "/resources", "/faq", "/contact", "/lead-magnet"];
  return [
    ...staticRoutes.map((path) => ({ url: `${baseUrl}${path}`, lastModified: new Date(), changeFrequency: "monthly" as const, priority: path === "" ? 1 : 0.8 })),
    ...properties.map((property) => ({ url: `${baseUrl}/stays/${property.slug}`, lastModified: new Date(property.updated_at ?? Date.now()), changeFrequency: "weekly" as const, priority: 0.7 }))
  ];
}

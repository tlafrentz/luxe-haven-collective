import type { MetadataRoute } from "next";
import { featuredProperties } from "@/lib/properties";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://luxehavencollective.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/stays", "/services", "/owners", "/about", "/resources", "/faq", "/contact", "/lead-magnet", "/resources/str-revenue-readiness-checklist"];
  return [
    ...routes.map((route) => ({ url: `${baseUrl}${route}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: route === "" ? 1 : 0.8 })),
    ...featuredProperties.map((property) => ({ url: `${baseUrl}/stays/${property.slug}`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 }))
  ];
}

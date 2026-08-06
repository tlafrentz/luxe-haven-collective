import type { MetadataRoute } from "next";
import { getPublishedProperties } from "@/lib/properties";
import { plans } from "@/lib/plans";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://luxehavencollective.com";
  const properties = await getPublishedProperties();
  const staticRoutes = [
    "",
    "/stays",
    "/services",
    "/solutions/guest-experience",
    "/solutions/investment",
    "/solutions/property-launch",
    "/solutions/operations",
    "/owners",
    "/about",
    "/approach",
    "/privacy",
    "/terms",
    "/resources",
    "/resources/insights",
    "/resources/playbooks",
    "/resources/templates",
    "/resources/market-reports",
    "/faq",
    "/contact",
    "/lead-magnet",
    "/get-started",
    "/performance",
    "/furnishing",
    "/performance/overview",
    "/performance/plans",
    ...plans.map((plan) => `/performance/plans/${plan.slug}`),
    "/platform/guidebook-studio/journey",
    "/platform/furnishing-studio/journey",
    "/platform/investment-intelligence/journey",
  ];
  return [
    ...staticRoutes.map((path) => ({
      url: `${baseUrl}${path}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.8,
    })),
    ...properties.map((property) => ({
      url: `${baseUrl}/stays/${property.slug}`,
      lastModified: new Date(property.updated_at ?? Date.now()),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}

import { z } from "zod";

const csvArray = z.string().transform((value) => value.split("\n").map((item) => item.trim()).filter(Boolean));

export const propertySchema = z.object({
  name: z.string().min(3, "Property name is required"),
  slug: z.string().min(3).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe slug"),
  headline: z.string().optional(),
  short_description: z.string().optional(),
  description: z.string().min(25, "Add a fuller property description"),
  property_type: z.string().min(2),
  address: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  bedrooms: z.coerce.number().int().min(0),
  bathrooms: z.coerce.number().min(0.5),
  max_guests: z.coerce.number().int().min(1),
  nightly_rate: z.coerce.number().min(0),
  cleaning_fee: z.coerce.number().min(0),
  service_fee: z.coerce.number().min(0),
  tax_rate: z.coerce.number().min(0).max(1),
  minimum_nights: z.coerce.number().int().min(1),
  check_in_time: z.string().min(2),
  check_out_time: z.string().min(2),
  status: z.enum(["draft", "active", "paused", "archived"]),
  amenities: csvArray,
  highlights: csvArray,
  house_rules: csvArray,
  featured_image: z.string().url().optional().or(z.literal("")),
  images: csvArray,
  seo_title: z.string().optional(),
  seo_description: z.string().optional()
});

export type PropertyFormValues = z.infer<typeof propertySchema>;

import { z } from "zod";

import {
  OrganizationValidationError,
  type OrganizationAddress,
  type OrganizationUpdate,
} from "../domain/organization";

const optionalText = (maximum: number) =>
  z.string().trim().max(maximum).transform((value) => value || undefined);

export function isIanaTimezone(value: string) {
  if (/^[+-]\d{2}:?\d{2}$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return value.includes("/");
  } catch {
    return false;
  }
}

function normalizeUrl(value: string | undefined) {
  if (!value) return undefined;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsafe");
  return url.toString();
}

const addressSchema = z.object({
  line1: optionalText(160),
  line2: optionalText(160),
  city: optionalText(100),
  region: optionalText(100),
  postalCode: optionalText(24),
  country: optionalText(2).transform((value) => value?.toUpperCase()),
}).strict().transform((address): OrganizationAddress | undefined =>
  Object.values(address).some(Boolean) ? address : undefined,
);

const organizationSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a display name.").max(120),
  legalName: optionalText(160),
  description: optionalText(2000),
  website: optionalText(500).superRefine((value, context) => {
    if (!value) return;
    try {
      normalizeUrl(value);
    } catch {
      context.addIssue({ code: "custom", message: "Enter a valid HTTP or HTTPS URL." });
    }
  }).transform(normalizeUrl),
  logoUrl: optionalText(1000).superRefine((value, context) => {
    if (!value) return;
    try {
      normalizeUrl(value);
    } catch {
      context.addIssue({ code: "custom", message: "Enter a valid HTTP or HTTPS logo URL." });
    }
  }).transform(normalizeUrl),
  businessEmail: optionalText(254).pipe(z.string().email("Enter a valid business email.").optional()),
  businessPhone: optionalText(40).transform((value) =>
    value ? value.replace(/[^\d+().\-\s]/g, "").replace(/\s+/g, " ").trim() : undefined,
  ),
  address: addressSchema.optional(),
  preferredContactMethod: z.enum(["email", "phone", "either"]).optional(),
  timezone: z.string().trim().refine(isIanaTimezone, "Choose a valid IANA timezone."),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use an ISO 4217 currency code."),
  language: z.string().trim().refine((value) => {
    if (!/^[a-z]{2,3}(-[A-Z]{2})?$/.test(value)) return false;
    try {
      return new Intl.Locale(value).toString() === value;
    } catch {
      return false;
    }
  }, "Use a valid language or locale code such as en-US."),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a two-letter country code."),
}).strict();

export type OrganizationInput = z.input<typeof organizationSchema>;

export function normalizeOrganizationInput(input: unknown): OrganizationUpdate {
  const result = organizationSchema.safeParse(input);
  if (!result.success) {
    const errors: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const field = issue.path.join(".");
      if (!(field in errors)) errors[field] = issue.message;
    }
    throw new OrganizationValidationError(errors);
  }
  return Object.freeze(result.data);
}

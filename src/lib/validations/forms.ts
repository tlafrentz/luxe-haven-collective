import { z } from "zod";

const name = z
  .string()
  .trim()
  .min(2, "Please enter your name.")
  .max(120, "Name is too long.");

const email = z
  .string()
  .trim()
  .email("Please enter a valid email address.")
  .max(180, "Email is too long.");

const optionalText = z
  .string()
  .trim()
  .max(180, "This field is too long.")
  .optional()
  .or(z.literal(""));

export const inquiryTypes = [
  "STR consulting",
  "Co-hosting or property management",
  "Owner partnership",
  "Stay or guest inquiry",
  "Listing optimization",
  "Texas notary service",
  "Partnership opportunity",
  "General question",
] as const;

export const contactInquirySchema = z
  .object({
    name,
    email,
    phone: optionalText,

    inquiryType: z.enum(inquiryTypes, {
      message: "Please select an inquiry type.",
    }),

    propertyMarket: optionalText,

    preferredDate: optionalText,
    appointmentLocation: optionalText,
    documentType: optionalText,
    signerCount: optionalText,

    message: z
      .string()
      .trim()
      .min(
        15,
        "Please share a few more details so we can respond with context.",
      )
      .max(2500, "Message is too long."),
  })
  .superRefine((input, context) => {
    if (input.inquiryType !== "Texas notary service") {
      return;
    }

    if (!input.phone || input.phone.trim().length < 7) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Please provide a phone number for the notary appointment.",
      });
    }

    if (
      !input.appointmentLocation ||
      input.appointmentLocation.trim().length < 2
    ) {
      context.addIssue({
        code: "custom",
        path: ["appointmentLocation"],
        message:
          "Please provide the appointment city or select remote online service.",
      });
    }

    if (!input.documentType || input.documentType.trim().length < 2) {
      context.addIssue({
        code: "custom",
        path: ["documentType"],
        message: "Please provide the general document type.",
      });
    }
  });

export const leadMagnetSchema = z.object({
  name,
  email,

  propertyMarket: z
    .string()
    .trim()
    .min(2, "Please enter your property market.")
    .max(180, "Property market is too long."),

  propertyStatus: z.enum(
    [
      "Planning a new STR",
      "Self-managing",
      "Managed by another company",
      "Exploring a purchase",
    ],
    {
      message: "Please select a property status.",
    },
  ),
});

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>;
export type LeadMagnetInput = z.infer<typeof leadMagnetSchema>;

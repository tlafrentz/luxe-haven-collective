import { z } from "zod";

const name = z.string().trim().min(2, "Please enter your name.").max(120, "Name is too long.");
const email = z.string().trim().email("Please enter a valid email address.").max(180, "Email is too long.");
const optionalText = z.string().trim().max(180, "This field is too long.").optional().or(z.literal(""));

export const contactInquirySchema = z.object({
  name,
  email,
  phone: optionalText,
  inquiryType: z.enum(["Owner partnership", "Guest inquiry", "Listing optimization", "General question"], {
    message: "Please select an inquiry type."
  }),
  propertyMarket: optionalText,
  message: z.string().trim().min(15, "Please share a few more details so we can respond with context.").max(2500, "Message is too long.")
});

export const leadMagnetSchema = z.object({
  name,
  email,
  propertyMarket: z.string().trim().min(2, "Please enter your property market.").max(180, "Property market is too long."),
  propertyStatus: z.enum(["Planning a new STR", "Self-managing", "Managed by another company", "Exploring a purchase"], {
    message: "Please select a property status."
  })
});

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>;
export type LeadMagnetInput = z.infer<typeof leadMagnetSchema>;

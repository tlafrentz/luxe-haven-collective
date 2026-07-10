"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  updateInquiryNotes,
  updateInquiryStatus,
  type InquiryStatus,
} from "@/lib/contact-inquiries";

const inquiryStatusSchema = z.enum([
  "new",
  "reviewed",
  "responded",
  "closed",
]);

const inquiryNotesSchema = z
  .string()
  .trim()
  .max(5000, "Internal notes cannot exceed 5,000 characters.");

export async function updateInquiryStatusAction(
  inquiryId: string,
  formData: FormData,
) {
  const parsed = inquiryStatusSchema.safeParse(
    formData.get("status"),
  );

  if (!parsed.success) {
    throw new Error("Invalid inquiry status.");
  }

  await updateInquiryStatus(
    inquiryId,
    parsed.data as InquiryStatus,
  );

  revalidatePath("/admin/inquiries");
  revalidatePath(`/admin/inquiries/${inquiryId}`);

  redirect(`/admin/inquiries/${inquiryId}?updated=status`);
}

export async function updateInquiryNotesAction(
  inquiryId: string,
  formData: FormData,
) {
  const parsed = inquiryNotesSchema.safeParse(
    formData.get("internalNotes") ?? "",
  );

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ??
        "Unable to save internal notes.",
    );
  }

  await updateInquiryNotes(inquiryId, parsed.data);

  revalidatePath("/admin/inquiries");
  revalidatePath(`/admin/inquiries/${inquiryId}`);

  redirect(`/admin/inquiries/${inquiryId}?updated=notes`);
}

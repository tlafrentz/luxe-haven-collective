import type { Metadata } from "next";
import { UpdatePasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Update Password | Luxe Haven Collective" };

export default function UpdatePasswordPage() {
  return <><h2 className="font-serif text-3xl text-stone-950">Choose a new password</h2><p className="mt-3 text-stone-600">Set a new password for your Luxe Haven account.</p><div className="mt-8"><UpdatePasswordForm /></div></>;
}

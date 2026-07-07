import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/password-forms";

export const metadata: Metadata = { title: "Reset Password | Luxe Haven Collective" };

export default function ForgotPasswordPage() {
  return <><h2 className="font-serif text-3xl text-stone-950">Reset your password</h2><p className="mt-3 text-stone-600">Enter your email and we’ll send a secure reset link.</p><div className="mt-8"><ForgotPasswordForm /></div></>;
}

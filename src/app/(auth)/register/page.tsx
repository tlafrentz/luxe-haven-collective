import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create Account | Luxe Haven Collective" };

export default function RegisterPage() {
  return <><h2 className="font-serif text-3xl text-stone-950">Create your portal account</h2><p className="mt-3 text-stone-600">Start as a guest or property owner. Admin roles are assigned internally.</p><div className="mt-8"><RegisterForm /></div></>;
}

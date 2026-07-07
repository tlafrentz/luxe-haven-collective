import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign In | Luxe Haven Collective" };

export default function LoginPage() {
  return <><h2 className="font-serif text-3xl text-stone-950">Welcome back</h2><p className="mt-3 text-stone-600">Sign in to access your Luxe Haven dashboard.</p><div className="mt-8"><LoginForm /></div></>;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WelcomeScreen } from "@/features/commerce-onboarding/welcome-screen";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Welcome",
  description: "Welcome to the Hospitality Performance Platform.",
};

export default async function WelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle<{ full_name: string | null }>();

  return (
    <main className="container-shell py-14 md:py-20">
      <WelcomeScreen name={profile?.full_name || undefined} />
    </main>
  );
}

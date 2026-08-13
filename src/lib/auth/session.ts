import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roleHome } from "@/lib/auth/roles";
import { resolveAdminAccess, resolvedProfileRole } from "@/lib/auth/admin";
import type { Profile, UserRole } from "@/types/database";

export async function getSessionProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const [{ data: profile }, adminAccess] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, phone, role")
      .eq("id", user.id)
      .maybeSingle<Profile>(),
    resolveAdminAccess(supabase),
  ]);

  const role = resolvedProfileRole(profile?.role, adminAccess.authorized);
  return {
    user,
    profile: profile ? { ...profile, role } : role === "admin" ? {
      id: user.id,
      full_name: null,
      email: user.email ?? null,
      phone: null,
      role,
    } : null,
  };
}

export async function requireUser() {
  const { user, profile } = await getSessionProfile();
  if (!user) redirect("/login");
  return { user, profile };
}

export async function requireRole(roles: UserRole[]) {
  const { user, profile } = await requireUser();
  const role = profile?.role ?? "guest";
  if (!roles.includes(role)) redirect(roleHome[role]);
  return { user, profile };
}

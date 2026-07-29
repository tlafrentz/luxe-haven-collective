import type { UserRole } from "@/types/database";

export type LandingPreference = "home" | "workspace" | "bookings" | "actions" | "intelligence";

const landingRoutes: Readonly<Record<LandingPreference, string>> = {
  home: "/dashboard",
  workspace: "/dashboard/workspace",
  bookings: "/dashboard/bookings",
  actions: "/dashboard/actions",
  intelligence: "/dashboard/understand",
};

export function safeInternalDestination(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  try {
    const parsed = new URL(value, "https://luxe-haven.local");
    return parsed.origin === "https://luxe-haven.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : null;
  } catch {
    return null;
  }
}

export function savedLandingDestination(value: string | null | undefined, role: UserRole): string | null {
  if (!value || !(value in landingRoutes)) return null;
  const preference = value as LandingPreference;
  if (role === "guest" && preference !== "home") return null;
  return landingRoutes[preference];
}

export function resolvePostLoginDestination(input: Readonly<{
  nextPath?: string | null;
  savedLanding?: string | null;
  role: UserRole;
  roleDefault: string;
}>): string {
  return safeInternalDestination(input.nextPath)
    ?? savedLandingDestination(input.savedLanding, input.role)
    ?? safeInternalDestination(input.roleDefault)
    ?? "/dashboard";
}

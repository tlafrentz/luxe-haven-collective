import type { UserRole } from "@/types/database";

export type LandingPreference =
  | "home"
  | "workspace"
  | "bookings"
  | "actions"
  | "intelligence";

const landingRoutes: Readonly<Record<LandingPreference, string>> = {
  home: "/dashboard",
  workspace: "/dashboard/workspace",
  bookings: "/bookings",
  actions: "/dashboard/actions",
  intelligence: "/dashboard/understand",
};

const legacyRouteAliases: Readonly<Record<string, string>> = {
  "/dashboard/bookings": "/bookings",
  "/dashboard/properties": "/properties",
  "/dashboard/messages": "/messages",
};

export function safeInternalDestination(
  value: string | null | undefined,
): string | null {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f]/.test(value)
  )
    return null;
  try {
    const parsed = new URL(value, "https://luxe-haven.local");
    if (parsed.origin !== "https://luxe-haven.local") return null;
    const pathname = legacyRouteAliases[parsed.pathname] ?? parsed.pathname;
    return `${pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function savedLandingDestination(
  value: string | null | undefined,
  role: UserRole,
): string | null {
  if (!value || !(value in landingRoutes)) return null;
  const preference = value as LandingPreference;
  if (role === "guest" && preference !== "home") return null;
  return landingRoutes[preference];
}

export function resolvePostLoginDestination(
  input: Readonly<{
    nextPath?: string | null;
    savedLanding?: string | null;
    role: UserRole;
    roleDefault: string;
  }>,
): string {
  return (
    safeInternalDestination(input.nextPath) ??
    savedLandingDestination(input.savedLanding, input.role) ??
    safeInternalDestination(input.roleDefault) ??
    "/dashboard"
  );
}

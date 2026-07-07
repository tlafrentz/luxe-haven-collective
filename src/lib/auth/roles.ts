import type { UserRole } from "@/types/database";

export const roleHome: Record<UserRole, string> = {
  guest: "/dashboard",
  owner: "/dashboard",
  admin: "/admin",
  cleaner: "/dashboard"
};

export const protectedRoutes = ["/dashboard", "/properties", "/bookings", "/messages", "/admin"];
export const adminRoutes = ["/admin"];

export function isProtectedRoute(pathname: string) {
  return protectedRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export function isAdminRoute(pathname: string) {
  return adminRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

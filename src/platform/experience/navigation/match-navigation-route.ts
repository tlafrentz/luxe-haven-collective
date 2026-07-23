function normalize(pathname: string) { const value = pathname.split("?")[0].replace(/\/+$/, ""); return value || "/"; }
export function matchesNavigationRoute(pathname: string, match: NavigationActiveMatch): boolean {
  const path = normalize(pathname);
  if (match.type === "exact") return path === normalize(match.href);
  if (match.type === "prefix") return path === normalize(match.prefix) || path.startsWith(`${normalize(match.prefix)}/`);
  return match.patterns.some(pattern => { const prefix = pattern.replace(/\/\*\*?$/, ""); return path === normalize(prefix) || path.startsWith(`${normalize(prefix)}/`); });
}
import type { NavigationActiveMatch } from "./navigation-types";

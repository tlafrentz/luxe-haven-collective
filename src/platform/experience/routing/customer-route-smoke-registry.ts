export type CustomerRouteSmokeEntry = Readonly<{
  routeId: string;
  path: string;
  expectedActiveNavigationId: string;
  authorization: "customer" | "workspace-admin" | "entitled-customer";
  context: "preserve" | "not-applicable";
}>;

/**
 * Safe, fixture-independent customer routes exercised by the PS-001A authenticated
 * smoke harness. Dynamic record routes remain in platformRouteDefinitions and are
 * exercised only when the controlled workspace supplies their fixture IDs.
 */
export const customerRouteSmokeRegistry = Object.freeze([
  { routeId: "home", path: "/dashboard", expectedActiveNavigationId: "home", authorization: "customer", context: "preserve" },
  { routeId: "workspace", path: "/dashboard/workspace", expectedActiveNavigationId: "workspace-overview", authorization: "workspace-admin", context: "preserve" },
  { routeId: "workspace-connected-systems", path: "/dashboard/workspace/connected-systems", expectedActiveNavigationId: "workspace-overview", authorization: "workspace-admin", context: "preserve" },
  { routeId: "observe-revenue", path: "/dashboard/observe/revenue", expectedActiveNavigationId: "observe", authorization: "customer", context: "preserve" },
  { routeId: "observe-financial", path: "/dashboard/observe/financial", expectedActiveNavigationId: "observe", authorization: "customer", context: "preserve" },
  { routeId: "observe-financial-expenses", path: "/dashboard/observe/financial/expenses", expectedActiveNavigationId: "observe", authorization: "customer", context: "preserve" },
  { routeId: "observe-financial-cash-flow", path: "/dashboard/observe/financial/cash-flow", expectedActiveNavigationId: "observe", authorization: "customer", context: "preserve" },
  { routeId: "observe-financial-forecast", path: "/dashboard/observe/financial/forecast", expectedActiveNavigationId: "observe", authorization: "customer", context: "preserve" },
  { routeId: "understand-executive", path: "/dashboard/understand/executive", expectedActiveNavigationId: "understand", authorization: "customer", context: "preserve" },
  { routeId: "understand-attention", path: "/dashboard/understand/executive/attention?type=data-quality", expectedActiveNavigationId: "understand", authorization: "customer", context: "preserve" },
  { routeId: "understand-portfolio", path: "/dashboard/understand/portfolio", expectedActiveNavigationId: "understand", authorization: "customer", context: "preserve" },
  { routeId: "understand-portfolio-properties", path: "/dashboard/understand/portfolio/properties", expectedActiveNavigationId: "understand", authorization: "customer", context: "preserve" },
  { routeId: "understand-portfolio-concentration", path: "/dashboard/understand/portfolio/concentration", expectedActiveNavigationId: "understand", authorization: "customer", context: "preserve" },
  { routeId: "understand-data-quality", path: "/dashboard/understand/portfolio/data-quality", expectedActiveNavigationId: "understand", authorization: "customer", context: "preserve" },
  { routeId: "investment-overview", path: "/dashboard/investments", expectedActiveNavigationId: "decide", authorization: "customer", context: "preserve" },
  { routeId: "investment-scenarios", path: "/dashboard/investments/scenarios", expectedActiveNavigationId: "decide", authorization: "customer", context: "preserve" },
  { routeId: "investment-opportunities", path: "/dashboard/investments/opportunities", expectedActiveNavigationId: "decide", authorization: "customer", context: "preserve" },
  { routeId: "execute", path: "/dashboard/execute", expectedActiveNavigationId: "execute", authorization: "customer", context: "preserve" },
  { routeId: "learn", path: "/dashboard/learn", expectedActiveNavigationId: "learn", authorization: "customer", context: "preserve" },
  { routeId: "properties", path: "/properties", expectedActiveNavigationId: "properties", authorization: "customer", context: "preserve" },
  { routeId: "bookings", path: "/bookings", expectedActiveNavigationId: "bookings", authorization: "customer", context: "preserve" },
  { routeId: "guest-communications", path: "/dashboard/communications", expectedActiveNavigationId: "messages", authorization: "customer", context: "preserve" },
  { routeId: "reports", path: "/dashboard/reports", expectedActiveNavigationId: "reports", authorization: "customer", context: "preserve" },
  { routeId: "guidebook-studio", path: "/dashboard/guidebooks", expectedActiveNavigationId: "guidebook-studio", authorization: "customer", context: "preserve" },
  { routeId: "guidebook-templates", path: "/dashboard/guidebooks/templates", expectedActiveNavigationId: "guidebook-studio", authorization: "customer", context: "preserve" },
  { routeId: "guidebook-brand", path: "/dashboard/guidebooks/brand", expectedActiveNavigationId: "guidebook-studio", authorization: "customer", context: "preserve" },
  { routeId: "furnishing-studio", path: "/dashboard/furnishing", expectedActiveNavigationId: "furnishing-studio", authorization: "entitled-customer", context: "preserve" },
] satisfies readonly CustomerRouteSmokeEntry[]);

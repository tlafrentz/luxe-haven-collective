import { describe, expect, it } from "vitest";
import { clientWorkspaceNavigation, matchesNavigationRoute } from "@/platform/experience";
import { pageDetails } from "./platform-shell";

describe("workspace navigation experience", () => {
  it.each(["/dashboard", "/bookings", "/properties", "/dashboard/portfolio", "/dashboard/investments/new"])(
    "has one active product destination for %s",
    (pathname) => {
      const active = clientWorkspaceNavigation.filter(
        (item) => item.activeMatch && matchesNavigationRoute(pathname, item.activeMatch),
      );
      expect(active).toHaveLength(1);
    },
  );

  it("presents Understand as the direct destination for its synthesis workspaces", () => {
    const understand = clientWorkspaceNavigation.find(({ id }) => id === "understand");
    expect(understand).toMatchObject({ level: 1, icon: "understand", href: "/dashboard/understand/executive" });
    expect(understand?.activeMatch && matchesNavigationRoute("/dashboard/understand/portfolio", understand.activeMatch)).toBe(true);
  });

  it("keeps the global sidebar at two levels",()=>{expect(Math.max(...clientWorkspaceNavigation.map(item=>item.level))).toBeLessThanOrEqual(2);});

  it("synchronizes booking shell context and breadcrumbs", () => {
    expect(pageDetails("/bookings", "client-workspace")).toMatchObject({
      eyebrow: "Business operations",
      title: "Bookings",
    });
  });
});

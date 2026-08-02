import { describe, expect, it } from "vitest";
import { clientWorkspaceNavigation, matchesNavigationRoute } from "@/platform/experience";
import { pageDetails } from "./platform-shell";

describe("workspace navigation experience", () => {
  it.each(["/dashboard", "/bookings", "/properties", "/dashboard/portfolio", "/dashboard/investments/new"])(
    "has one active product destination for %s",
    (pathname) => {
      const active = clientWorkspaceNavigation.filter(
        (item) => item.kind !== "group" && item.activeMatch && matchesNavigationRoute(pathname, item.activeMatch),
      );
      expect(active).toHaveLength(1);
    },
  );

  it("presents Portfolio Intelligence as an Understand peer", () => {
    const portfolio = clientWorkspaceNavigation.find(({ id }) => id === "portfolio-intelligence");
    expect(portfolio).toMatchObject({ parentId: "understand", level: 2, icon: "understand" });
  });

  it("keeps the global sidebar at two levels",()=>{expect(Math.max(...clientWorkspaceNavigation.map(item=>item.level))).toBeLessThanOrEqual(2);});

  it("synchronizes booking shell context and breadcrumbs", () => {
    expect(pageDetails("/bookings", "client-workspace")).toMatchObject({
      eyebrow: "Business operations",
      title: "Bookings",
    });
  });
});

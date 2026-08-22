// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { createExecutiveIntelligenceView } from "../test-support/factories";
import { ExecutiveWorkspace } from "./executive-workspace";

describe("ExecutiveWorkspace",()=>{
  afterEach(()=>cleanup());
  it("keeps Executive Intelligence focused and routes attention into Understand",()=>{
    const view=createExecutiveIntelligenceView({scope:{properties:[{id:"property-1",name:"Retreat"}],selectedProperty:{id:"property-1",name:"Retreat"},propertyCount:1,startDate:"2026-07-01",endDate:"2026-08-01",scopeKnown:true}});
    render(<ExecutiveWorkspace view={view} tab="overview"/>);
    expect(screen.queryByRole("navigation",{name:"Executive Intelligence views"})).toBeNull();
    expect(screen.getByRole("link",{name:"Review Attention"}).getAttribute("href")).toBe("/dashboard/understand/executive/attention");
    expect(screen.queryByRole("link",{name:"Business Health"})).toBeNull();
  });
  it("distinguishes percentage-point occupancy changes",()=>{
    const view=createExecutiveIntelligenceView({performance:{available:true,grossRevenue:{value:100,trend:{percentChange:12.4,direction:"up"}},occupancyRate:{value:68.4,trend:{percentChange:4.6,direction:"up"}},averageDailyRate:{value:214,trend:null},revPar:{value:146,trend:null},totalBookings:4,upcomingBookings:2}});
    render(<ExecutiveWorkspace view={view} tab="performance"/>);
    expect(screen.getByText("↑ 4.6 pp")).toBeTruthy();
    expect(screen.getByText("↑ 12.4%")).toBeTruthy();
  });
});

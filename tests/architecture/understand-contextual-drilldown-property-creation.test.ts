import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe,expect,it } from "vitest";
const read=(path:string)=>readFileSync(resolve(path),"utf8");

describe("UI-003D contextual drill-down and property creation",()=>{
  it("removes self-referential actions from contextual menus",()=>{
    const actions=read("src/features/financial-intelligence/presentation/financial-shell-actions.tsx");
    expect(actions).toContain("!onAttention && !onDataQuality");
    expect(actions).toContain("getIntelligenceReportRequestHref");
    expect(actions).not.toContain("window.print");
  });
  it("renders Portfolio primary tabs only on primary surfaces",()=>{
    const layout=read("src/app/(dashboard)/dashboard/understand/portfolio/layout.tsx");
    const navigation=read("src/components/intelligence-workspace-navigation.tsx");
    expect(layout).toContain("hideOnDiagnostics");
    expect(navigation).toContain('pathname.endsWith("/data-quality")');
    expect(navigation).toContain('searchParams?.has("property")');
  });
  it("routes Add Property to a canonical create-or-import choice",()=>{
    const properties=read("src/app/(portal)/properties/page.tsx");
    const chooser=read("src/app/(portal)/properties/new/page.tsx");
    expect(existsSync(resolve("src/app/(portal)/properties/new/page.tsx"))).toBe(true);
    expect(properties).toContain('href="/properties/new"');
    expect(chooser).toContain("Enter property manually");
    expect(chooser).toContain("Import from connected system");
    expect(chooser).toContain("ManualPropertyForm");
    expect(chooser).toContain("/dashboard/workspace/connected-systems?returnTo=");
  });
  it("keeps manual creation provider-independent",()=>{
    const action=read("src/app/actions/workspace-setup.ts");
    expect(action).toContain("createManualPropertyAction");
    expect(action).toContain("create_manual_workspace_property");
    expect(action).not.toMatch(/createManualPropertyAction[\s\S]{0,1800}connected-systems/);
  });
});

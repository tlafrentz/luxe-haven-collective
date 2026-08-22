import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { intelligenceActionContracts, understandRoutes } from "@/platform/experience";

const root=process.cwd();
const read=(path:string)=>readFileSync(resolve(root,path),"utf8");
function files(directory:string):string[]{return readdirSync(directory).flatMap(name=>{const path=join(directory,name);return statSync(path).isDirectory()?files(path):[path]})}
function appPageFor(route:string){const relative=route.replace(/^\/dashboard\/?/,"");return resolve(root,"src/app/(dashboard)/dashboard",relative,"page.tsx")}

describe("UI-003C Understand route and action closure",()=>{
  it("classifies every audited intelligence action with one tested outcome",()=>{
    expect(intelligenceActionContracts.length).toBeGreaterThanOrEqual(8);
    expect(new Set(intelligenceActionContracts.map(item=>item.id)).size).toBe(intelligenceActionContracts.length);
    for(const action of intelligenceActionContracts){expect(["navigation","command","drawer","modal","external","disabled"]).toContain(action.kind);expect(action.outcome.trim()).not.toBe("")}
  });

  it("resolves every canonical Understand navigation contract to an application page",()=>{
    for(const route of [understandRoutes.executive,understandRoutes.attention,understandRoutes.portfolio,understandRoutes.portfolioProperties,understandRoutes.portfolioConcentration,understandRoutes.portfolioDataQuality])expect(existsSync(appPageFor(route)),route).toBe(true);
  });

  it("keeps production CTA implementations out of the retired Executive workspace",()=>{
    const sources=[...files(resolve(root,"src/features/executive-intelligence")),...files(resolve(root,"src/features/portfolio-intelligence")),resolve(root,"src/features/financial-intelligence/presentation/financial-shell-actions.tsx")].filter(path=>/\.(tsx?|jsx?)$/.test(path)&&!path.endsWith(".test.tsx"));
    const source=sources.map(path=>readFileSync(path,"utf8")).join("\n");
    expect(source).not.toMatch(/href=[{"'`]\/dashboard\/understand\/executive\/(health|performance|risks)/);
    expect(source).not.toMatch(/destination:["'`]\/dashboard\/understand\/executive\/(health|performance|risks)/);
  });

  it("renders canonical Attention and Data Quality pages without the legacy ExecutiveWorkspace",()=>{
    expect(read("src/app/(dashboard)/dashboard/understand/executive/attention/page.tsx")).not.toContain("ExecutivePageView");
    expect(read("src/app/(dashboard)/dashboard/understand/portfolio/data-quality/page.tsx")).not.toContain("ExecutivePageView");
    expect(read("src/features/portfolio-intelligence/presentation/portfolio-overview.tsx")).toContain("SupportingSignalsDrawer");
  });

  it("keeps contextual drill-downs inside their parent intelligence capability",()=>{
    expect(understandRoutes.attention).toBe("/dashboard/understand/executive/attention");
    expect(understandRoutes.portfolioDataQuality).toBe("/dashboard/understand/portfolio/data-quality");
    const header=read("src/components/intelligence-workspace-navigation.tsx");
    expect(header).toContain("understandCapability");
    expect(header).toContain("diagnostic");
    expect(read("src/features/portfolio-intelligence/presentation/portfolio-property-comparison.tsx")).not.toContain('href="/dashboard/execute/actions"');
  });

  it("preserves the originating intelligence route through diagnostic returns",()=>{
    const actions=read("src/features/financial-intelligence/presentation/financial-shell-actions.tsx");
    const signals=read("src/features/portfolio-intelligence/presentation/supporting-signals-drawer.tsx");
    expect(actions).toContain("returnTo=${encodeURIComponent(returnTarget)}");
    expect(signals).toContain("returnTo=${encodeURIComponent(returnTo)}");
  });

  it("keeps export actions on the single reporting command boundary",()=>{
    const actions=read("src/features/financial-intelligence/presentation/financial-shell-actions.tsx");
    expect(actions).toContain("getIntelligenceReportRequestHref");
    expect(actions).not.toContain("window.print");
    expect(actions).not.toMatch(/reports\/definitions\//);
  });
});

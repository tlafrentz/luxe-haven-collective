import fs from "node:fs";
import path from "node:path";
import {describe,expect,it} from "vitest";

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),"utf8");
describe("UI-003 Understand IA",()=>{
  it("keeps global period and comparison out of local Portfolio controls",()=>{
    const properties=read("src/features/portfolio-intelligence/presentation/portfolio-property-comparison.tsx");
    const concentration=read("src/features/portfolio-intelligence/presentation/portfolio-composition.tsx");
    expect(properties).not.toContain('<Control label="Period"');expect(properties).not.toContain('<Control label="Comparison"');
    expect(concentration).not.toContain('<Control label="Period"');expect(concentration).not.toContain('<Control label="Comparison"');
  });
  it("routes legacy Executive workspace pages into the canonical lifecycle",()=>{
    expect(read("src/app/(dashboard)/dashboard/understand/actions/page.tsx")).toContain("/dashboard/execute/actions");
    expect(read("src/app/(dashboard)/dashboard/understand/outcomes/page.tsx")).toContain("/dashboard/learn/outcomes");
    expect(read("src/app/(dashboard)/dashboard/understand/risks/page.tsx")).toContain("/dashboard/understand/attention");
  });
});

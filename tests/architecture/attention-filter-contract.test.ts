import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {describe,expect,it} from "vitest";
const read=(path:string)=>readFileSync(resolve(path),"utf8");
describe("UI-003D.1 Attention filter interaction contract",()=>{
  it("uses URL-addressable accessible controls with observable selected state",()=>{const page=read("src/app/(dashboard)/dashboard/understand/executive/attention/page.tsx");expect(page).toContain('role="tablist"');expect(page).toContain('role="tab"');expect(page).toContain("aria-selected");expect(page).toContain('query.set("type",type)');expect(page).toContain("filterExecutiveAttention(view.attention,filter)")});
  it("provides filter-specific zero-result messages",()=>{const page=read("src/app/(dashboard)/dashboard/understand/executive/attention/page.tsx");expect(page).toContain("No current attention items");expect(page).toContain("No performance items require attention");expect(page).toContain("No risks currently require attention");expect(page).toContain("No data-quality items currently require attention")});
  it("removes implementation-oriented default empty copy",()=>{const list=read("src/features/executive-intelligence/components/executive-attention-list.tsx");expect(list).not.toContain("Connected providers returned")});
});

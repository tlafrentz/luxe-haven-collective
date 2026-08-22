import {describe,expect,it} from "vitest";
import type {ExecutiveAttentionItem,ExecutiveAttentionSummary} from "../domain";
import {filterExecutiveAttention,parseExecutiveAttentionFilter} from "./filter-executive-attention";
const item=(id:string,category:string):ExecutiveAttentionItem=>({id,rank:1,source:"intelligence",sourceId:id,title:id,summary:id,category,urgency:"high",impact:1,confidence:90,attentionScore:90,occurredAt:new Date("2026-08-21T00:00:00Z")});
const revenue=item("revenue","revenue"),risk=item("risk","operations"),quality=item("quality","data-quality"),other=item("other","governance");
const attention:ExecutiveAttentionSummary={priorities:[revenue,risk,quality,other],risks:[risk],opportunities:[revenue]};
describe("UI-003D.1 canonical Attention filters",()=>{
  it("filters one canonical queue without creating alternate records",()=>{
    expect(filterExecutiveAttention(attention,"all")).toBe(attention);
    expect(filterExecutiveAttention(attention,"performance").priorities).toEqual([revenue]);
    expect(filterExecutiveAttention(attention,"risk").priorities).toEqual([risk]);
    expect(filterExecutiveAttention(attention,"data-quality").priorities).toEqual([quality]);
  });
  it("accepts direct filter URLs and safely defaults invalid values",()=>{
    expect(parseExecutiveAttentionFilter("performance")).toBe("performance");
    expect(parseExecutiveAttentionFilter("risk")).toBe("risk");
    expect(parseExecutiveAttentionFilter("data-quality")).toBe("data-quality");
    expect(parseExecutiveAttentionFilter("unknown")).toBe("all");
  });
});

import { describe, expect, it } from "vitest";
import { InMemoryIncomeStatementCache } from ".";
describe("Income Statement cache",()=>{it("invalidates backdated and reclassified affected periods",async()=>{const cache=new InMemoryIncomeStatementCache();await cache.put("one",{identity:{workspaceId:"w"},period:{from:"2026-07-01",to:"2026-07-31"}} as never);await cache.invalidate({workspaceId:"w",from:"2026-07-15",reason:"reclassification"});expect(cache.size()).toBe(0);});});

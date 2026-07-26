import { describe, expect, it } from "vitest";
import { InMemoryCashFlowLiquidityCache } from ".";

describe("cash-flow cache",()=>{
  it("invalidates only affected workspace periods",async()=>{
    const cache=new InMemoryCashFlowLiquidityCache(),base={identity:{workspaceId:"w"},period:{to:"2026-07-31"}} as never;
    await cache.put("w:jul",base);
    await cache.put("other:jul",{identity:{workspaceId:"other"},period:{to:"2026-07-31"}} as never);
    await cache.invalidate({workspaceId:"w",from:"2026-07-01",reason:"backdated-entry"});
    expect(await cache.get("w:jul")).toBeNull();
    expect(await cache.get("other:jul")).not.toBeNull();
  });
});

import { describe,expect,it } from "vitest";
import { digestPeriod,nextDigestDelivery } from "./notification-digest";

describe("PS-002 notification digest scheduling",()=>{
  const digest={frequency:"daily" as const,day:1,time:"08:00"};
  it("does not make a daily digest due before its local delivery time",()=>{
    expect(digestPeriod({now:new Date("2026-08-28T12:59:00Z"),timezone:"America/Chicago",frequency:"daily-digest",digest})).toBeNull();
    expect(digestPeriod({now:new Date("2026-08-28T13:01:00Z"),timezone:"America/Chicago",frequency:"daily-digest",digest})).toMatchObject({frequency:"daily",periodKey:"2026-08-28"});
  });
  it("keeps immediate, daily, weekly, and off semantics distinct",()=>{
    const now=new Date("2026-08-31T14:00:00Z");
    expect(digestPeriod({now,timezone:"America/Chicago",frequency:"immediate",digest})?.frequency).toBe("immediate");
    expect(digestPeriod({now,timezone:"America/Chicago",frequency:"off",digest})).toBeNull();
    expect(digestPeriod({now,timezone:"America/Chicago",frequency:"weekly-digest",digest:{frequency:"weekly",day:1,time:"08:00"}})?.frequency).toBe("weekly");
  });
  it("displays timezone and next scheduled delivery explicitly",()=>{
    expect(nextDigestDelivery(new Date("2026-08-28T12:00:00Z"),"America/Chicago",digest)).toContain("08:00 (America/Chicago)");
  });
});

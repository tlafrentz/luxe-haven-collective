import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {baselinePillarSchema,dataConnectionSchema,foundingPartnerPropertySchema} from "./application";
import {HPM_PILLARS} from "./activate";
const sql=readFileSync("supabase/migrations/20260818040000_fp001_activate.sql","utf8");

describe("FP-001C activate schema",()=>{
  it("captures properties and connections as program-scoped data, never the canonical properties table",()=>{
    expect(sql).toContain("create table public.founding_partner_properties");
    expect(sql).toContain("create table public.founding_partner_data_connections");
    expect(sql).toContain("create table public.founding_partner_baseline");
    expect(sql).not.toContain("insert into public.properties");
  });
  it("enables RLS on every new table",()=>{
    for(const table of["founding_partner_properties","founding_partner_data_connections","founding_partner_baseline"])
      expect(sql).toContain(`alter table public.${table} enable row level security`);
  });
  it("keeps the baseline pillar list in sync with the real HPM_PILLARS vocabulary",()=>{
    for(const pillar of HPM_PILLARS)expect(sql).toContain(pillar);
  });
  it("makes customer_program_audit_events append-only",()=>{
    expect(sql).toContain("customer_program_audit_events_append_only");
    expect(sql).toContain("execute function public.reject_append_only_change()");
  });
  it("extends the founding_partner_events check to include the new onboarding/baseline events",()=>{
    expect(sql).toContain("founding_partner_onboarding_completed");
    expect(sql).toContain("founding_partner_baseline_completed");
  });
});

describe("FP-001C activate validation",()=>{
  it("validates a property without requiring the canonical properties fields",()=>{
    expect(foundingPartnerPropertySchema.parse({programId:crypto.randomUUID(),name:"Sea Pine Retreat",address:"",propertyType:"",unitCount:"4",notes:""}).name).toBe("Sea Pine Retreat");
  });
  it("only accepts the four defined data source types",()=>{
    expect(()=>dataConnectionSchema.parse({programId:crypto.randomUUID(),sourceType:"crm",status:"connected",notes:""})).toThrow();
    expect(dataConnectionSchema.parse({programId:crypto.randomUUID(),sourceType:"pms",status:"connected",notes:""}).sourceType).toBe("pms");
  });
  it("constrains baseline completeness to 0-100 and a real pillar",()=>{
    expect(()=>baselinePillarSchema.parse({programId:crypto.randomUUID(),pillar:"revenue",status:"partial",dataCompletenessPercent:"150",notes:""})).toThrow();
    expect(()=>baselinePillarSchema.parse({programId:crypto.randomUUID(),pillar:"not-a-pillar",status:"partial",dataCompletenessPercent:"50",notes:""})).toThrow();
  });
});

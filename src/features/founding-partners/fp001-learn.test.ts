import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {actionSchema,day90ReviewSchema,feedbackSchema,monthlyReviewSchema,opportunitySchema,outcomeSchema} from "./application";
const sql=readFileSync("supabase/migrations/20260818050000_fp001_learn.sql","utf8");

describe("FP-001D learn schema",()=>{
  it("defines opportunities/actions/outcomes as correctable working documents, distinct from platform recommendations",()=>{
    expect(sql).toContain("create table public.founding_partner_opportunities");
    expect(sql).toContain("create table public.founding_partner_actions");
    expect(sql).toContain("create table public.founding_partner_outcomes");
  });
  it("makes monthly reviews, feedback, and the Day-90 review append-only",()=>{
    for(const trigger of["founding_partner_monthly_reviews_append_only","founding_partner_feedback_append_only","founding_partner_day90_reviews_append_only"])
      expect(sql).toContain(trigger);
    expect(sql.match(/execute function public\.reject_append_only_change\(\)/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("allows exactly one Day-90 review per program",()=>{
    expect(sql).toContain("customer_program_id uuid not null unique references public.customer_programs(id)");
  });
  it("enables RLS on every new table",()=>{
    for(const table of["founding_partner_opportunities","founding_partner_actions","founding_partner_outcomes","founding_partner_monthly_reviews","founding_partner_feedback","founding_partner_day90_reviews"])
      expect(sql).toContain(`alter table public.${table} enable row level security`);
  });
  it("extends the founding_partner_events check with the Learn-phase events",()=>{
    for(const event of["founding_partner_review_completed","founding_partner_day90_completed","founding_partner_converted","founding_partner_exited"])
      expect(sql).toContain(event);
  });
});

describe("FP-001D learn validation",()=>{
  it("requires an opportunity title but treats evidence/impact as optional narrative",()=>{
    expect(()=>opportunitySchema.parse({programId:crypto.randomUUID(),title:"",confidence:"unknown",status:"identified"})).toThrow();
    expect(opportunitySchema.parse({programId:crypto.randomUUID(),title:"Weekday pricing gap",confidence:"moderate",status:"identified"}).title).toBe("Weekday pricing gap");
  });
  it("requires a decision on every action",()=>{
    expect(()=>actionSchema.parse({programId:crypto.randomUUID(),decision:"",status:"planned"})).toThrow();
  });
  it("constrains outcome status to the four defined values",()=>{
    expect(()=>outcomeSchema.parse({actionId:crypto.randomUUID(),programId:crypto.randomUUID(),status:"done"})).toThrow();
    expect(outcomeSchema.parse({actionId:crypto.randomUUID(),programId:crypto.randomUUID(),status:"measured"}).status).toBe("measured");
  });
  it("requires a summary for a monthly review and a review month",()=>{
    expect(()=>monthlyReviewSchema.parse({programId:crypto.randomUUID(),reviewMonth:"2026-08",summary:""})).toThrow();
    expect(()=>monthlyReviewSchema.parse({programId:crypto.randomUUID(),reviewMonth:"",summary:"Good progress this month."})).toThrow();
  });
  it("requires a feedback type, signal maturity, and summary",()=>{
    expect(()=>feedbackSchema.parse({programId:crypto.randomUUID(),feedbackType:"pain_point",signalMaturity:"early_signal",summary:""})).toThrow();
  });
  it("requires a rationale for the Day-90 recommended next step",()=>{
    expect(()=>day90ReviewSchema.parse({programId:crypto.randomUUID(),recommendedNextStep:"convert",rationale:""})).toThrow();
    expect(day90ReviewSchema.parse({programId:crypto.randomUUID(),recommendedNextStep:"convert",rationale:"Clear ROI on revenue management."}).recommendedNextStep).toBe("convert");
  });
});

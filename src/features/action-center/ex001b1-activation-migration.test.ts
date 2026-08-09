import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync("supabase/migrations/20260809021000_ex001b1_plan_activation_outbox.sql","utf8");
describe("EX-001B1 activation migration",()=>{
  it("provides one database transaction for plan, actions, activity, and notification intents",()=>{expect(sql).toContain("create or replace function public.activate_execute_action_plan");expect(sql).toContain("perform public.platform_action_add(action_payload)");expect(sql).toContain("insert into public.platform_action_activity");expect(sql).toContain("insert into public.execute_notification_outbox");expect(sql).toContain("for update");});
  it("uses a durable idempotent provider-neutral outbox",()=>{expect(sql).toContain("unique (workspace_id,idempotency_key)");for(const channel of ["in-app","email","sms","slack","teams"])expect(sql).toContain(`'${channel}'`);expect(sql).not.toMatch(/send(email|sms|slack|teams)/i);});
  it("claims work concurrently and limits delivery transitions to the worker role",()=>{expect(sql).toContain("for update skip locked");expect(sql).toContain("attempt_count=intent.attempt_count+1");expect(sql).toContain("create or replace function public.complete_execute_notification_delivery");expect(sql).toContain("grant execute on function public.claim_execute_notification_outbox(integer) to service_role");expect(sql).toContain("grant execute on function public.complete_execute_notification_delivery(text,text,boolean,text,timestamptz) to service_role");});
  it("enables RLS and grants no outbox privileges to anonymous users",()=>{expect(sql).toContain("alter table public.execute_notification_outbox enable row level security");expect(sql).not.toMatch(/grant\s+[^;]+\s+to\s+anon/i);});
});

import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const migration=readFileSync("supabase/migrations/20260726220000_guidebook_publishing_pipeline.sql","utf8");
describe("GBS-004A publishing persistence",()=>{
 it("persists idempotent recoverable publishing jobs",()=>{expect(migration).toContain("create table public.guidebook_publish_jobs");expect(migration).toContain("idempotency_key text not null unique");expect(migration).toContain("lease_expires_at");expect(migration).toContain("claim_guidebook_publish_job");});
 it("activates exactly one immutable published version atomically",()=>{expect(migration).toContain("activate_guidebook_publication");expect(migration).toContain("guidebook_one_active_version_idx");expect(migration).toContain("where status='published'");expect(migration).toContain("set status='superseded'");expect(migration).toContain("public_url_status='active'");});
 it("records publication provenance and notes",()=>{for(const field of["publication_notes","property_version","projection_version","activated_at"])expect(migration).toContain(field);expect(migration).toContain("public-activation-completed");});
 it("retires the legacy direct publishing path",()=>expect(migration).toContain("revoke execute on function public.publish_guidebook_version"));
});

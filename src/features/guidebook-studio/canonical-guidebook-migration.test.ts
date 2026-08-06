import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
const sql=readFileSync("supabase/migrations/20260806011000_lhc_gs_001_canonical_guidebook_schema.sql","utf8");
describe("LHC-GS-001 persistence",()=>{
 it("persists the canonical hierarchy and reusable bindings",()=>{for(const table of ["guidebook_canonical_versions","guidebook_canonical_sections","guidebook_component_instances","guidebook_content_records","guidebook_property_variable_bindings","guidebook_canonical_media_bindings","guidebook_template_assignments","guidebook_localized_variants"])expect(sql).toContain(`public.${table}`)});
 it("persists immutable publications, imports, validation, and lineage",()=>{for(const table of ["guidebook_publications","guidebook_publication_snapshots","guidebook_validation_issues","guidebook_import_jobs","guidebook_import_proposals","guidebook_canonical_audit"])expect(sql).toContain(`public.${table}`);expect(sql).toContain("protect_guidebook_publication_snapshot");expect(sql).toContain("canonical_guidebook_version_immutable");expect(sql).toContain("idempotency_key")});
 it("enables row-level security and withholds anonymous canonical records",()=>{expect(sql).toContain("enable row level security");expect(sql).toContain("revoke all on public.guidebook_publication_snapshots");expect(sql).toContain("from anon,authenticated")});
});

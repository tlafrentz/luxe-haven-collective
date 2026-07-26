import{readFileSync,readdirSync,statSync}from"node:fs";import{join}from"node:path";import{describe,expect,it}from"vitest";
const root=join(process.cwd(),"src/platform/learning");
function files(directory:string):string[]{return readdirSync(directory).flatMap(name=>{const path=join(directory,name);return statSync(path).isDirectory()?files(path):path.endsWith(".ts")?[path]:[]})}
describe("Platform Learning boundary",()=>{
 it("does not import feature implementations",()=>{for(const file of files(root)){const source=readFileSync(file,"utf8");expect(source,`feature dependency in ${file}`).not.toMatch(/from\s+[\"']@\/features\//)}}); 
 it("keeps the canonical persistence concepts in the migration",()=>{const sql=readFileSync(join(process.cwd(),"supabase/migrations/20260726070000_platform_learning_lineage.sql"),"utf8");for(const table of["learning_subjects","learning_lineage","learning_measurement_plans","learning_expected_outcomes","learning_measured_outcomes","learning_outcome_reviews","learning_assumption_results","learning_lessons","learning_lesson_evidence","learning_activity"])expect(sql).toContain(`public.${table}`);expect(sql).toContain("prevent_learning_history_change")});
});

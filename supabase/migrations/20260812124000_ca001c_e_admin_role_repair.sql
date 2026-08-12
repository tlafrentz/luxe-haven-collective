-- Bounded forward repair for CA-001C/D functions created before production
-- validation exposed the canonical profiles.user_role enum.
do $$
declare function_name regprocedure;definition text;
begin
 foreach function_name in array array[
  'public.create_onboarding_plan(uuid,jsonb,jsonb,jsonb,text,text)'::regprocedure,
  'public.transition_onboarding_module(uuid,uuid,text,integer,text,text,text)'::regprocedure,
  'public.unlock_onboarding_module(uuid,uuid,integer,text)'::regprocedure,
  'public.transition_onboarding_case_lifecycle(uuid,uuid,text,integer,text,text)'::regprocedure,
  'public.record_onboarding_provisioning_attempt(uuid,jsonb,text,jsonb,text)'::regprocedure,
  'public.create_first_value_journey(uuid,jsonb,text,text)'::regprocedure,
  'public.record_first_value_evidence(uuid,uuid,jsonb,text)'::regprocedure,
  'public.complete_first_value_journey(uuid,uuid,integer,text,text,text,text)'::regprocedure,
  'public.claim_first_value_processing(uuid,uuid,text,uuid,integer,text)'::regprocedure,
  'public.finish_first_value_processing(uuid,uuid,text,uuid,text,text,text)'::regprocedure
 ]loop
  definition:=pg_catalog.pg_get_functiondef(function_name);
  definition:=replace(definition,'role in(''admin'',''administrator'')','role=''admin''');
  definition:=replace(definition,'role IN (''admin'', ''administrator'')','role = ''admin''');
  if definition like '%administrator%'then raise exception'ADMIN_ROLE_REPAIR_INCOMPLETE:%',function_name::text;end if;
  execute definition;
 end loop;
end$$;

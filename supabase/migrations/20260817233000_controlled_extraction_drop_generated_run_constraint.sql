do $$
declare v_constraint text;
begin
 for v_constraint in
   select c.conname
   from pg_catalog.pg_constraint c
   where c.conrelid='public.guidebook_controlled_extraction_launches'::regclass
     and c.contype='u'
 loop
   execute format('alter table public.guidebook_controlled_extraction_launches drop constraint %I',v_constraint);
 end loop;
end$$;

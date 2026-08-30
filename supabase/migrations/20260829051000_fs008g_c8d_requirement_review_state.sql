-- FS-008G C8-D: align the controlled requirement review transition with persistence.
begin;

alter table public.furnishing_room_requirements
  drop constraint if exists furnishing_room_requirements_lifecycle_status_check;
alter table public.furnishing_room_requirements
  add constraint furnishing_room_requirements_lifecycle_status_check
  check (lifecycle_status in ('draft','in_review','approved','deprecated','archived'));

commit;

-- FS-008G canonical package review state alignment.
begin;
alter table public.furnishing_packages drop constraint furnishing_packages_lifecycle_status_check;
alter table public.furnishing_packages add constraint furnishing_packages_lifecycle_status_check check(lifecycle_status in('draft','in_review','approved','deprecated','archived'));
alter table public.furnishing_package_versions drop constraint furnishing_package_versions_lifecycle_status_check;
alter table public.furnishing_package_versions add constraint furnishing_package_versions_lifecycle_status_check check(lifecycle_status in('draft','in_review','approved','superseded'));
commit;

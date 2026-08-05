-- Keep vector markup out of the v1 upload pipeline until a dedicated SVG sanitizer exists.
update storage.buckets
set allowed_mime_types=array['image/jpeg','image/png','image/webp','image/avif','video/mp4','application/pdf']
where id='guidebook-library-media';

alter table public.guidebook_library_media_files
  drop constraint if exists guidebook_library_media_files_mime_type_check;
alter table public.guidebook_library_media_files
  add constraint guidebook_library_media_files_mime_type_check
  check (mime_type in ('image/jpeg','image/png','image/webp','image/avif','video/mp4','application/pdf'));

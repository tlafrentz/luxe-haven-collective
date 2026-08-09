-- GS: capture image dimensions on upload so publish-readiness can flag
-- low-resolution images. Existing rows are left null (not backfilled);
-- the readiness check only flags assets it has dimensions for.
alter table public.guidebook_media_assets
  add column width integer check (width is null or width > 0),
  add column height integer check (height is null or height > 0);

# Property CMS

This build adds a Supabase-backed property management system.

## Migration

Run the new migration after pulling this package:

```bash
supabase db push
```

It adds additional marketing, pricing, SEO, and rules fields to `public.properties`, creates `public.property_media`, and configures a public `property-images` Supabase Storage bucket with admin-only write policies.

## Admin workflow

1. Sign in as a user with `profiles.role = 'admin'`.
2. Open `/admin/properties`.
3. Create a property at `/admin/properties/new`.
4. Use status `active` to publish it to `/stays` and `/stays/[slug]`.

## Images

This pass supports featured image and gallery image URLs directly in the CMS form. The Storage bucket and policies are ready for the next UI pass, where drag-and-drop uploads can write to the `property-images` bucket and insert `property_media` records.

## Dynamic marketing pages

- `/stays` now fetches active properties from Supabase.
- `/stays/[slug]` now fetches the published property by slug.
- `sitemap.ts` includes published property detail URLs.

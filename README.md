# Luxe Haven Admin Property Management System

This feature bundle adds a real admin property CMS backed by your existing Supabase `properties` table.

## What it adds

- Admin property list at `/admin/properties`
- Search and status filters
- Create property page
- Edit property page
- Publish/unpublish/archive/delete actions
- Reusable property form
- Property status badges
- Supabase-backed public `/stays` page
- Dynamic public `/stays/[slug]` pages
- SEO metadata from property records

## Install

From your project root:

```bash
cp -R /path/to/lhc_admin_property_management/files/* .
```

Or manually copy the `files/` contents into the matching project paths.

## Test

```bash
npm run dev
```

Open:

```text
http://localhost:3000/admin/properties
```

Make sure your logged-in profile has `role = 'admin'` in `public.profiles`.

## Commit

```bash
git add .
git commit -m "feat: add admin property management system"
git push -u origin feature/property-cms
```

## Notes

This feature uses the current enum values from your initial migration:

- `draft`
- `active`
- `inactive`
- `archived`

The public marketing site treats `active` as published.

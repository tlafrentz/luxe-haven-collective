# Luxe Haven Collective

Boutique short-term rental hospitality platform built with Next.js, TypeScript, Tailwind CSS, and Supabase.

## Sprint 3: Complete Luxury Marketing Website

This build includes a polished marketing site foundation:

- Homepage with luxury hero, featured stays, owner services, value props, and CTA sections
- Stays listing page and property detail pages
- Services page
- Owners landing page
- About page
- Resources page
- FAQ page
- Contact page
- Lead magnet landing page
- Shared header, footer, page hero, section heading, CTA, cards, and property components
- SEO foundation with metadata, sitemap, and robots
- Existing owner/admin portal shells preserved

## Local Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env.local` and add Supabase/Resend values when you are ready to wire forms, auth, email, and database-backed listings.

## Next Product Milestones

1. Connect contact and lead magnet forms to Supabase + Resend
2. Add Supabase Auth with roles for admin, owner, guest, cleaner, and contractor
3. Replace static properties with database-backed CMS records
4. Build booking request/availability flow
5. Expand owner portal with live property performance data

# Luxe Haven Collective

Boutique short-term rental hospitality platform for premium guest stays, owner reporting, and internal operations.

## Stack

- Next.js App Router
- React + TypeScript
- Tailwind CSS v4
- Supabase Auth, Database, and Storage foundation
- React Hook Form + Zod ready
- Resend ready for transactional email

## Getting Started

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Environment

Add Supabase and email values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
CONTACT_TO_EMAIL=
```

## Routes

- `/` marketing homepage
- `/stays` property listing page
- `/stays/[slug]` property detail page
- `/about` brand/about page
- `/contact` owner/guest inquiry form shell
- `/dashboard` owner portal
- `/properties` owner property view
- `/bookings` booking table shell
- `/messages` message shell
- `/admin` internal admin dashboard
- `/api/health` health check

## Supabase

Run the migration in `supabase/migrations/0001_initial_schema.sql` and optionally seed sample properties with `supabase/seed.sql`.

## Sprint 2 Status

Built:
- Public marketing site
- Featured property system
- Property detail pages
- Owner portal shell
- Admin dashboard shell
- Supabase schema and seed data
- CI workflow

Next:
- Connect live Supabase queries
- Add auth pages and role redirects
- Wire contact form to Resend
- Add booking request workflow

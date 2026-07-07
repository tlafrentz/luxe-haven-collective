# Luxe Haven Collective Architecture

## Application
- Next.js App Router with route groups for marketing, owner portal, and admin.
- Tailwind CSS v4 design tokens in `src/app/globals.css`.
- Supabase SSR utilities in `src/lib/supabase`.

## Domains
- Marketing site: property discovery, owner lead generation, brand content.
- Guest booking: property pages and booking requests; payment flow planned for Sprint 3.
- Owner portal: revenue, occupancy, bookings, maintenance, and messages.
- Admin dashboard: internal operations and portfolio oversight.

## Data
Supabase tables include profiles, properties, bookings, messages, and maintenance requests.

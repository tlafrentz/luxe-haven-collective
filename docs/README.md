# Luxe Haven Collective

A production hospitality operations platform for short-term rental owners, operators, and guests.

Luxe Haven Collective combines a polished marketing website, property management, operational administration, analytics, and live PMS synchronization in a single Next.js application.

**Production:** https://luxehavencollective.co

## Platform Capabilities

### Marketing and Lead Generation

- Public hospitality website
- Dynamic property listings and stay pages
- Services, owner, notary, resource, FAQ, and contact pages
- Lead-magnet delivery
- Search-engine metadata, sitemap, and robots configuration
- Resend-powered inquiry and lead notifications

### Property Management

- Admin property inventory
- Create, edit, publish, pause, and archive workflows
- Property media management
- Listing content, pricing, amenities, house rules, and SEO fields
- Supabase-backed public property pages

### Luxe Insights

- Property-level analytics
- Revenue and occupancy trends
- Booking performance summaries
- Date-range comparisons
- Operational recommendations
- Live property selector
- Hospitable-synced booking data

### Hospitable Integration

- Hospitable property discovery and synchronization
- Reservation synchronization
- External-property mapping
- Duplicate reservation protection
- Batch processing
- Protected manual sync endpoint
- Sync history and status tracking
- Concurrent-sync prevention
- Provider timeouts and controlled error handling

### Authentication and Administration

- Supabase authentication
- Role-based access
- Protected admin and dashboard routes
- Admin-only integration controls
- Row Level Security policies
- Server-only service-role operations

## Technology

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Supabase
- PostgreSQL
- Vercel
- Hospitable API
- Resend
- Recharts
- Zod
- React Hook Form

## Architecture

The project uses a feature-first structure for business capabilities and App Router route groups for user-facing application areas.

```text
src/
├── app/
│   ├── (admin)/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── (marketing)/
│   ├── (portal)/
│   ├── actions/
│   └── api/
├── components/
│   ├── admin/
│   ├── auth/
│   ├── forms/
│   ├── marketing/
│   ├── portal/
│   ├── property/
│   ├── shared/
│   └── ui/
├── features/
│   ├── analytics/
│   └── integrations/
├── lib/
└── types/

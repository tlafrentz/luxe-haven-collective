# Architecture

## Overview

Luxe Haven Collective is a production Next.js application that combines:

- A public hospitality marketing website
- Supabase authentication
- Role-based administration
- Property management
- Analytics and operational insights
- Hospitable property and reservation synchronization
- Production deployment through Vercel

The application uses a feature-first architecture for complex business capabilities and Next.js route groups for user-facing application areas.

## High-Level System Diagram

```text
                         ┌───────────────────────┐
                         │       Browser         │
                         └───────────┬───────────┘
                                     │
                                     ▼
                         ┌───────────────────────┐
                         │   Next.js App Router  │
                         │   Vercel Functions    │
                         └───────┬───────┬───────┘
                                 │       │
                    ┌────────────┘       └────────────┐
                    ▼                                 ▼
        ┌───────────────────────┐         ┌───────────────────────┐
        │       Supabase        │         │    Hospitable API     │
        │                       │         │                       │
        │ PostgreSQL            │         │ Properties            │
        │ Authentication        │         │ Reservations          │
        │ Row Level Security    │         │ Financial data        │
        └───────────┬───────────┘         └───────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │        Resend         │
        │ Inquiry notifications │
        │ Lead delivery         │
        └───────────────────────┘

Core Architecture Principles

The project follows several operating principles:

Keep secrets server-only.
Keep business logic out of route files.
Use feature-first ownership for complex capabilities.
Represent every database change as a migration.
Protect privileged operations independently of the user interface.
Prefer idempotent synchronization and stable external identifiers.
Validate every release with lint, typecheck, build, Preview, and production smoke tests.
Prefer complete-file replacements for substantial refactors when that reduces editing risk.
Application Structure

The main source structure is:

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
Next.js Route Groups

The App Router is organized by user experience.

Marketing
src/app/(marketing)/

Contains the public website:

Homepage
About
Services
Owners
Stays
Dynamic property detail pages
Contact
FAQ
Resources
Lead magnet
Notary services

These routes are public and optimized for discovery, lead generation, and property presentation.

Authentication
src/app/(auth)/

Contains:

Login
Registration
Forgot password
Password update
Supabase authentication callback

Supabase manages authentication and session persistence.

Admin
src/app/(admin)/

Contains operational administration:

Admin dashboard
Property inventory
Property creation
Property editing
Property media management
Owner administration
Inquiry administration
Integrations
Sync history

Admin access is protected through middleware, session checks, role checks, and Supabase Row Level Security.

Dashboard
src/app/(dashboard)/

Contains Luxe Insights and analytical reporting.

The dashboard consumes analytics feature modules and Supabase booking data.

Portal
src/app/(portal)/

Contains portal foundations for:

Bookings
Properties
Messages
Dashboard access

This area is designed to support owner and guest experiences as the platform expands.

Feature-First Architecture

Complex business capabilities live under:

src/features/

Current feature modules include:

src/features/analytics/
src/features/integrations/

A feature may contain:

feature/
├── components/
├── lib/
├── types/
└── index.ts

Feature modules should own:

Feature-specific components
Types
Data access
Business rules
Calculations
Provider adapters
Formatting
Public exports

Route files should primarily:

Resolve route parameters
Verify access
Load feature data
Compose feature components
Return framework responses

Route files should not contain substantial business logic.

Analytics Feature

The analytics feature lives in:

src/features/analytics/

It owns:

Booking analytics types
Revenue calculations
Occupancy calculations
Date-range resolution
Period comparisons
Revenue trend series
Occupancy trend series
Performance summaries
Recommendations
Dashboard components
Supabase analytics queries

The public feature entry point is:

src/features/analytics/index.ts

Consumers should prefer the public barrel instead of deep imports into implementation folders.

Integrations Feature

Shared integration concerns live in:

src/features/integrations/

This feature owns:

Integration dashboard data
Connection status presentation
Sync controls
Sync history
Shared integration types

Provider-specific logic is isolated within its own subfeature.

Hospitable Integration

Hospitable-specific code lives in:

src/features/integrations/hospitable/

It owns:

Hospitable API client
Provider configuration
Property discovery
Reservation discovery
Property mapping
Reservation mapping
Batch execution
Property synchronization
Reservation synchronization
Sync authorization
Provider types

The public Hospitable entry point is:

src/features/integrations/hospitable/index.ts
Hospitable Reservation Sync Flow

The reservation synchronization flow is:

Admin or authorized secret request
        │
        ▼
Protected API route
        │
        ▼
Authorization check
        │
        ▼
Concurrent-run protection
        │
        ▼
Stale-run cleanup
        │
        ▼
Linked property discovery
        │
        ▼
Reservation summary discovery
        │
        ▼
Reservation detail batching
        │
        ▼
Provider-to-booking mapping
        │
        ▼
Supabase booking upsert
        │
        ▼
Sync-history finalization
        │
        ▼
Connection status update

Production protections include:

Admin session authorization
Optional shared-secret authorization
Server-only Hospitable token access
HTTPS provider URL validation
Provider-request timeout
Controlled public error messages
Duplicate reservation constraints
Concurrent-sync database lock
Stale-running-sync cleanup
Best-effort failed-run finalization
Supabase Architecture

Supabase provides:

PostgreSQL
Authentication
Row Level Security
Database migrations
Application data storage
Browser Client
src/lib/supabase/client.ts

Used for browser-side authenticated operations.

Server Client
src/lib/supabase/server.ts

Used for server-side requests scoped to the current user session.

Admin Client
src/lib/supabase/admin.ts

Used for privileged server-only operations requiring the service-role key.

The service-role key:

Must remain server-only
Must never use a NEXT_PUBLIC_ prefix
Must never be returned to the browser
Bypasses Row Level Security
Requires strict control at every call site
Authentication and Authorization

Supabase Auth manages identity and sessions.

Application roles include:

guest
owner
admin
cleaner

Authorization is enforced through:

Middleware
Protected route handling
Server-side session checks
Server-side role checks
Supabase Row Level Security
Admin service-role isolation

A protected route should never rely only on navigation visibility or client-side checks.

Database

Supabase PostgreSQL stores data including:

Profiles
Properties
Bookings
Contact inquiries
Lead submissions
Integration connections
External properties
Integration sync runs

Schema changes must be captured in:

supabase/migrations/

Production schema changes should not exist only as manual dashboard edits.

Booking Integration Fields

Hospitable-synced bookings use stable external identifiers, including:

external_provider
external_reservation_id
external_property_id
external_platform
booking_code
external_guest_id
last_synced_at
raw_payload

The combination of:

external_provider
external_reservation_id

acts as the stable identity for provider-sourced reservations.

This supports idempotent upserts and prevents duplicate imports.

Database Migrations

Migration files are stored under:

supabase/migrations/

The migration flow is:

supabase migration list
supabase db push
supabase migration list

Every Local migration should have a matching Remote migration after deployment.

Applied migrations should not be edited retroactively. Corrections should be made through new migrations.

Row Level Security

Row Level Security protects authenticated tables.

Examples include:

Profile access
Property administration
Booking access
Integration connection administration
External property administration
Sync-history administration

Privileged service-role operations bypass RLS and therefore require server-side protection.

Server Actions

Server Actions handle application mutations such as:

Authentication workflows
Contact forms
Lead forms
Property operations
Inquiry operations
Property media operations

Business logic should be delegated to validation and library modules where possible.

API Routes

API routes are used when explicit HTTP semantics or external callers are required.

Current important API routes include:

GET /api/health
POST /api/admin/integrations/hospitable/sync

The Hospitable sync route:

Requires an authenticated admin session or valid shared secret
Uses Node.js runtime
Disables caching
Returns controlled public errors
Records operational details in server logs
Shared Components

Reusable interface components live under:

src/components/

Major component areas include:

Admin
Authentication
Forms
Marketing
Portal
Property
Shared shell
UI primitives

Feature-specific components should remain inside their feature unless they are genuinely reusable across unrelated capabilities.

Image Handling

Application images use next/image.

The project convention is:

Use fill inside a relative container
Provide explicit sizes
Use priority only for above-the-fold or LCP-critical images
Configure approved remote image hosts in next.config.ts
Avoid raw <img> elements in application components
Email Architecture

Resend is used for:

Contact inquiry notifications
Lead-magnet delivery
Operational email flows

Relevant modules include:

src/lib/email/
src/app/actions/forms.ts

Email credentials and destination addresses are server-only environment variables.

Deployment Architecture

The production deployment flow is:

Local development
        │
        ▼
Short-lived Git branch
        │
        ▼
Lint, typecheck, build
        │
        ▼
GitHub push
        │
        ▼
Vercel Preview deployment
        │
        ▼
Preview smoke test
        │
        ▼
Merge to main
        │
        ▼
Vercel Production deployment
        │
        ▼
Production smoke test
        │
        ▼
Release tag

Production infrastructure:

GitHub stores source code
Vercel builds and serves the application
Supabase provides database and authentication
Hospitable provides PMS data
Resend provides email delivery
GoDaddy currently manages DNS
Production domain is https://luxehavencollective.co
Environment Boundaries

Environment variables fall into three categories.

Public

Safe to expose to the browser:

NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
Server-only

Must never reach the browser:

SUPABASE_SERVICE_ROLE_KEY
HOSPITABLE_API_TOKEN
HOSPITABLE_SYNC_SECRET
RESEND_API_KEY
RESEND_FROM_EMAIL
CONTACT_TO_EMAIL
Script-only or optional

Used primarily for local operational scripts:

HOSPITABLE_API_BASE_URL
HOSPITABLE_SYNC_START_DATE
HOSPITABLE_SYNC_END_DATE
HOSPITABLE_SYNC_BATCH_SIZE
Public Feature Barrels

Feature modules expose stable public entry points through index.ts.

Consumers should prefer:

import {
  featureExport,
} from "@/features/example";

instead of importing deeply into internal implementation files.

This reduces coupling and makes feature refactoring safer.

Error Handling

Production-facing errors should:

Avoid exposing provider payloads
Avoid exposing database internals
Avoid exposing secrets
Return stable HTTP statuses
Log detailed errors only on the server
Record operational failures in sync history when applicable
Observability

Current operational visibility comes from:

Vercel logs
Sync history
Integration connection status
Supabase data
Health endpoint
Production smoke tests

Future observability improvements may include:

Structured logging
Error aggregation
Performance monitoring
Alerting on failed syncs
Scheduled health checks
Extensibility

The architecture is designed to support future capabilities such as:

Additional PMS providers
Pricing platforms
Owner reporting
Revenue intelligence
Guest messaging
Digital guidebooks
Operational task management
Direct booking
Accounting integrations

Each external provider should be isolated behind its own feature submodule and mapping layer.

Development Standards

For substantial changes:

Read the complete file.
Prefer a complete-file replacement when it reduces editing risk.
Keep business logic in feature or library modules.
Run:
npm run lint
npm run typecheck
npm run build
git diff --check
Test a Preview deployment.
Test Production after merge.
Update documentation and the changelog when behavior changes.

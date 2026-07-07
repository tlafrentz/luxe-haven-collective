# Database Schema

Core tables:
- `profiles`: app users and roles.
- `properties`: managed STR listings.
- `bookings`: guest stays and reservation requests.
- `messages`: booking-related communication.
- `maintenance_requests`: operational issue tracking.

See `supabase/migrations/0001_initial_schema.sql` for executable SQL.

## Marketing form tables

### contact_inquiries

Stores owner, guest, listing optimization, and general inquiries submitted from the contact page.

### lead_magnet_downloads

Stores checklist download leads from the owner lead magnet landing page.

Both tables use RLS and are intended to be written by server actions using the Supabase service role key.

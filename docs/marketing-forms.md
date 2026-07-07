# Marketing Forms

The marketing website now includes server-action powered forms for:

- Contact inquiries (`/contact`)
- STR Revenue Readiness Checklist downloads (`/lead-magnet`)

## Data flow

1. The client form submits to a Next.js server action.
2. Zod validates the payload.
3. The server action inserts the record into Supabase using `SUPABASE_SERVICE_ROLE_KEY`.
4. Resend sends an internal notification to `CONTACT_TO_EMAIL`.
5. Resend sends the visitor a confirmation email.

## Required environment variables

```bash
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
CONTACT_TO_EMAIL=
```

## Supabase migration

Run `supabase/migrations/0002_marketing_forms.sql` after the initial schema. The form tables have RLS enabled and no public policies because inserts are handled by server actions with the service role key.

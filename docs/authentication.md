# Authentication & Role Routing

This build wires Supabase Auth into Luxe Haven Collective.

## Routes

- `/login` — existing users sign in
- `/register` — guests and property owners can create an account
- `/forgot-password` — sends a Supabase password reset email
- `/update-password` — password update screen after a reset callback
- `/auth/callback` — exchanges Supabase email confirmation/reset codes for a session
- `/dashboard`, `/properties`, `/bookings`, `/messages` — protected portal routes
- `/admin` — admin-only route

## Roles

Supported roles are defined in the `public.user_role` enum:

- `guest`
- `owner`
- `admin`
- `cleaner`

Public registration allows `guest` and `owner`. Admin and team roles should be assigned internally in Supabase.

## Supabase Setup

Run the new migration after the existing schema migrations:

```bash
supabase db push
```

The `0003_auth_profiles_and_policies.sql` migration adds:

- `handle_new_user()` profile creation trigger
- `is_admin()` helper function
- admin policies for core tables
- owner read access for bookings and maintenance tied to their properties

## Auth Redirect URLs

In Supabase Auth settings, add these redirect URLs for local and production environments:

```txt
http://localhost:3000/auth/callback
https://yourdomain.com/auth/callback
```

Also set `NEXT_PUBLIC_SITE_URL` in your deployment environment.

# Environment Variables

## Overview

Luxe Haven Collective uses a small set of environment variables for authentication, third-party integrations, email delivery, and deployment configuration.

Secrets should never be committed to Git.

Production secrets are stored in Vercel.

---

# Public Variables

Public variables are exposed to the browser.

They **must** begin with:

```
NEXT_PUBLIC_
```

## NEXT_PUBLIC_SUPABASE_URL

Supabase project URL.

Example:

```
https://xxxxxxxx.supabase.co
```

---

## NEXT_PUBLIC_SUPABASE_ANON_KEY

Supabase anonymous client key.

Used by browser authentication.

Safe for public use.

---

## NEXT_PUBLIC_SITE_URL

Canonical production URL.

Production:

```
https://luxehavencollective.co
```

Preview deployments may override this automatically.

---

# Server Variables

These variables are **never** exposed to the browser.

---

## SUPABASE_SERVICE_ROLE_KEY

Server-only administrator key.

Used by:

- server actions
- Hospitable synchronization
- privileged database operations

Never expose this value.

---

## RESEND_API_KEY

API key for Resend.

Used for:

- contact inquiries
- lead magnets
- operational email

---

## RESEND_FROM_EMAIL

Verified sender address.

Example:

```
hello@luxehavencollective.co
```

---

## CONTACT_TO_EMAIL

Destination address for contact form submissions.

Example:

```
hello@luxehavencollective.co
```

---

# Hospitable Integration

## HOSPITABLE_API_TOKEN

Personal access token issued by Hospitable.

Used for:

- property discovery
- reservation synchronization

Server only.

---

## HOSPITABLE_API_BASE_URL

Optional.

Defaults to:

```
https://api.hospitable.com/v2
```

Normally does not need to be overridden.

---

## HOSPITABLE_SYNC_SECRET

Optional shared secret allowing authorized server-to-server sync requests.

When supplied as:

```
Authorization: Bearer <secret>
```

the API may execute a sync without an authenticated browser session.

Recommendations:

- minimum 32 random bytes
- generated from a password manager
- rotate if compromised

---

## HOSPITABLE_SYNC_START_DATE

Optional.

Used only by local synchronization scripts.

---

## HOSPITABLE_SYNC_END_DATE

Optional.

Used only by local synchronization scripts.

---

## HOSPITABLE_SYNC_BATCH_SIZE

Optional.

Controls reservation detail batching for local scripts.

---

# Local Development

Local configuration lives in:

```
.env.local
```

This file should never be committed.

---

# Production

Production variables are managed through Vercel.

List variables:

```bash
npx vercel env ls production
```

Pull locally:

```bash
npx vercel env pull
```

---

# Security Guidelines

Never:

- commit secrets
- email secrets
- log secrets
- expose secrets to client components

Always:

- use server-only modules
- access secrets with `process.env`
- rotate compromised credentials
- remove unused variables

---

# Current Environment Variables

| Variable | Required | Public |
|-----------|----------|--------|
| NEXT_PUBLIC_SUPABASE_URL | Yes | Yes |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Yes | Yes |
| NEXT_PUBLIC_SITE_URL | Yes | Yes |
| SUPABASE_SERVICE_ROLE_KEY | Yes | No |
| RESEND_API_KEY | Yes | No |
| RESEND_FROM_EMAIL | Yes | No |
| CONTACT_TO_EMAIL | Yes | No |
| HOSPITABLE_API_TOKEN | Yes | No |
| HOSPITABLE_SYNC_SECRET | Recommended | No |
| HOSPITABLE_API_BASE_URL | Optional | No |
| HOSPITABLE_SYNC_START_DATE | Optional | No |
| HOSPITABLE_SYNC_END_DATE | Optional | No |
| HOSPITABLE_SYNC_BATCH_SIZE | Optional | No |

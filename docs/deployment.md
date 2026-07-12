# Deployment Guide

## Overview

Luxe Haven Collective is deployed using:

- GitHub
- Vercel
- Supabase
- Resend
- Hospitable

Production URL:

```
https://luxehavencollective.co
```

Preview deployments are automatically created for every pushed branch.

---

# Deployment Architecture

```
Developer
    │
    ▼
Git Branch
    │
    ▼
GitHub
    │
    ▼
Vercel Preview Deployment
    │
    ▼
Smoke Testing
    │
    ▼
Merge to main
    │
    ▼
Production Deployment
    │
    ▼
Production Smoke Test
```

---

# Environments

## Local

Runs using:

```bash
npm run dev
```

Uses:

```
.env.local
```

---

## Preview

Automatically created for every pushed branch.

Purpose:

- UI review
- Regression testing
- QA
- Production verification before merge

Preview deployments should always pass:

- lint
- typecheck
- build
- smoke tests

before merging.

---

## Production

Production deploys from:

```
main
```

Production URL:

```
https://luxehavencollective.co
```

---

# Standard Release Process

## 1. Create a branch

Example:

```bash
git checkout -b feature/my-feature
```

or

```bash
git checkout -b chore/my-change
```

---

## 2. Implement changes

Run continuously:

```bash
npm run lint
npm run typecheck
npm run build
```

Fix every error before continuing.

Warnings should be addressed whenever practical.

---

## 3. Verify formatting

Run:

```bash
git diff --check
```

Expected:

```
(no output)
```

---

## 4. Review changes

```bash
git diff --stat
```

Review:

- deleted files
- renamed files
- migrations
- API changes
- environment changes

---

## 5. Commit

Example:

```bash
git add .
git commit -m "feat: add booking timeline"
```

---

## 6. Push

```bash
git push -u origin feature/my-feature
```

---

## 7. Verify Preview Deployment

Wait for Vercel:

```
Ready
```

Inspect deployment:

```bash
npx vercel list
```

or

```bash
npx vercel inspect <deployment-url>
```

---

## 8. Smoke Test Preview

Verify:

- Homepage
- Login
- Admin
- Dashboard
- Integrations
- Insights
- Property pages
- API health
- Sync button
- Contact form

---

## 9. Merge to main

Merge after Preview passes.

---

## 10. Verify Production

Production checklist:

- Homepage loads
- Login works
- Admin loads
- Dashboard loads
- Integrations load
- Hospitable sync works
- Contact form works
- Lead magnet works

---

## 11. Tag release

Example:

```bash
git tag v1.1.0
git push origin v1.1.0
```

---

# Required Validation Commands

Every release should pass:

```bash
npm run lint
npm run typecheck
npm run build
git diff --check
```

---

# Supabase Deployment

## Verify migrations

```bash
supabase migration list
```

---

## Apply migrations

```bash
supabase db push
```

---

## Verify again

```bash
supabase migration list
```

Local and Remote migration histories should match.

---

# Environment Variables

Production variables are managed in Vercel.

Inspect:

```bash
npx vercel env ls production
```

Download:

```bash
npx vercel env pull
```

Do not commit downloaded environment files.

---

# Secrets

Never commit:

- API keys
- service-role keys
- sync secrets
- provider tokens

Secrets belong only in:

- Vercel
- local `.env.local`

---

# Preview Verification

Typical verification commands:

```bash
npx vercel list
```

```bash
npx vercel inspect <deployment>
```

```bash
curl https://preview-url/api/health
```

---

# Production Verification

Typical verification:

```bash
curl https://luxehavencollective.co/api/health
```

Verify:

- HTTP 200
- expected JSON
- no authentication errors

---

# Hospitable Verification

After deployment:

1. Open Admin → Integrations
2. Click **Sync Now**
3. Verify:

- successful completion
- sync history entry
- bookings updated
- no duplicate bookings
- no concurrent-sync errors

---

# Rollback

If production fails:

1. Identify previous successful deployment

```bash
npx vercel list
```

2. Promote previous deployment from the Vercel dashboard or CLI.

3. Investigate the regression.

4. Create a corrective branch.

Never modify production directly.

---

# Release Checklist

Before release:

- [ ] lint passes
- [ ] typecheck passes
- [ ] build passes
- [ ] migrations applied
- [ ] Preview verified
- [ ] Production environment variables verified
- [ ] smoke tests passed
- [ ] documentation updated
- [ ] changelog updated
- [ ] release tagged

---

# Branch Strategy

Use short-lived branches.

Examples:

```
feature/*
```

```
fix/*
```

```
chore/*
```

```
docs/*
```

Merge frequently.

Delete merged branches after successful deployment.

---

# Current Production Stack

Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS

Backend

- Next.js Route Handlers
- Server Actions

Database

- Supabase PostgreSQL

Authentication

- Supabase Auth

Hosting

- Vercel

Email

- Resend

Property Management

- Hospitable API

---

# Operational Philosophy

Every production deployment should be:

- repeatable
- documented
- reversible
- observable
- validated

No deployment should rely on manual code edits in production.

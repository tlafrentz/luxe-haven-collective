# Production Runbook

## Purpose

This document describes the operational procedures for running Luxe Haven Collective in production.

---

# Daily Health Check

Verify:

- Homepage loads
- Admin login works
- Dashboard loads
- Integrations page loads
- Property pages render
- Contact form submits
- Health endpoint returns 200

---

# Health Endpoint

```
GET /api/health
```

Expected:

- HTTP 200
- JSON response
- no server errors

---

# Hospitable Sync

Navigate to:

```
Admin
→ Integrations
```

Click:

```
Sync Now
```

Verify:

- success notification
- sync history updated
- bookings updated
- connection status Active

---

# Failed Sync

Check:

1. Integration status
2. Sync history
3. Vercel logs
4. Hospitable API token
5. Supabase availability

If the sync reports:

```
SYNC_ALREADY_RUNNING
```

wait for the current run to finish.

The database prevents concurrent reservation syncs.

---

# Database

Verify migrations:

```bash
supabase migration list
```

Apply migrations:

```bash
supabase db push
```

Never edit production tables manually unless performing an emergency repair.

---

# Deployments

Verify Preview:

```bash
npx vercel list
```

Inspect:

```bash
npx vercel inspect <deployment>
```

Production deploys from:

```
main
```

---

# Logs

Primary log sources:

- Vercel
- Supabase
- Sync history

Investigate failures before retrying synchronization.

---

# Rollback Procedure

1. Identify previous healthy deployment.

2. Promote previous deployment.

3. Verify production.

4. Open a corrective branch.

5. Investigate root cause.

---

# Release Validation

Run:

```bash
npm run lint
npm run typecheck
npm run build
git diff --check
```

Verify:

## Market-backed Investment Workspace

Before promotion:

1. Configure the documented Market variables in Preview and Production.
2. Verify `GET /api/admin/integrations/market/health` as an administrator.
3. Run the known-property, unit-property, invalid-address, and simulated-failure checks from the RMI readiness record.
4. Confirm no address, financial input, provider payload, or secret appears in logs.
5. Confirm the Server Action runs in the Node runtime with sufficient duration for bounded provider calls.

If health is degraded, follow `docs/runbooks/market-provider-failures.md`. Rollback is documented in `docs/runbooks/investment-workspace-analysis.md`.

- Preview
- Production
- Health endpoint
- Hospitable sync

---

# Backup Strategy

Source code:

- GitHub

Database:

- Supabase backups

Configuration:

- Vercel environment variables

---

# Incident Priorities

## P0

- Site unavailable
- Authentication failure
- Database unavailable

Respond immediately.

---

## P1

- Hospitable sync broken
- Admin unavailable
- Booking failures

Respond same day.

---

## P2

- Minor UI issues
- Documentation
- Styling regressions

Schedule into normal development.

---

# Routine Maintenance

Monthly:

- review environment variables
- rotate secrets if necessary
- review Vercel deployments
- review Supabase migrations
- remove stale branches
- update documentation

---

# Future Operational Improvements

- Scheduled reservation sync
- Monitoring and alerting
- Structured logging
- Error aggregation
- Automated health checks
- Scheduled backup verification

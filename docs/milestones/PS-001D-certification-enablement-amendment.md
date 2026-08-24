# PS-001D Certification Enablement Amendment

**Recorded:** 2026-08-23

**Status:** Authorized for bounded implementation

**Blocked candidate retained:** `7197dec75f2ec2198005bee26a61117499fd659e`

**Blocked deployment retained:** `dpl_6P5g6RG5DcTaHybiiQTdfJow8VaD`

**Blocked correlation retained and prohibited from reuse:** `ps001d-9c9672ea-a324-4fca-9858-1cbc6bb5add8`

## Authority and boundary

This amendment authorizes one new bounded candidate solely to implement the production-certification controls already required by the PS-001D release contract. It does not authorize Business or Services feature expansion, application permission grants, impersonation, a generic production executor, arbitrary SQL or deletion, provider mutation, payments, publication, catalog activation, or FS-008 activation.

The bounded controls are:

1. A server-enforced, one-shot PS-001D claim bound atomically to milestone, candidate commit, deployment ID, controlled tenant, correlation ID, approved verification operator, acquisition/expiration timestamps, and terminal lifecycle.
2. Explicit expiring verification-only authorization for Admin, authorized operator, authorized customer/owner, wrong-tenant authenticated user, and anonymous scenarios. These records never grant application access.
3. A typed PS-001D resource ledger whose entries are restricted to the controlled tenant, approved resource types, claim, candidate, deployment, and correlation ID.
4. Deterministic, idempotent reverse-dependency cleanup through approved domain cleanup operations, with append-only evidence retained and post-cleanup reconciliation.
5. A read-only, fail-closed preflight that validates the exact deployment identity chain, alias, tenant, identity set, claim availability, ledger/cleanup capability, migration/configuration parity, catalog/FS-008 isolation, and absence of a conflicting active claim.
6. Terminal revocation/expiry, permanent replay rejection, ledger closure, and disabling of entry when no authorized run remains.

## Required proof

Focused automated coverage must prove concurrency, replay rejection, binding substitution rejection, Admin-only acquisition, identity expiry/revocation and non-elevation, anonymous and wrong-tenant handling, transactional ledger behavior, cleanup isolation/order/retry/idempotency/recovery, post-mutation claim behavior, FS-008/catalog isolation, and sanitized outputs.

After all local gates pass, the verification-only diff must be frozen as a new candidate and deployed exactly. A fresh correlation ID is mandatory. Production mutation remains prohibited until the new read-only preflight passes and the one-shot claim is acquired. The claim may be used once and never reset or bypassed.

The blocked-run evidence remains legitimate milestone history and may be committed with the new candidate without changing the identity or outcome of the blocked `7197dec7` attempt.

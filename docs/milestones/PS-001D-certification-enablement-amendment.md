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

## Two-stage target correction

Pre-claim target validation requires an approved, unexpired `PS001D_VERIFICATION_ONLY_NON_CUSTOMER` tenant and its canonical ID. It validates the ordinary Admin, operator, owner, wrong-tenant, and anonymous scenarios; exact candidate/deployment/alias/correlation identity; authorizations; claim availability; ledger and cleanup capability; migration/configuration parity; and the absence of customer, provider, payment, publication, automation, and catalog relationships. A dormant controlled tenant is valid. An active property or booking is not a pre-claim requirement, and no real customer tenant or record may be substituted.

After the claim is acquired and permanently consumed for its first authorized mutation, the run may create exactly one draft PS-001D synthetic property and one pending PS-001D synthetic booking through the bounded domain fixture operations. Each canonical row and its typed ledger entry are committed atomically. The booking must reference the claim-bound property and tenant. Provider synchronization, payment, notification, publication, automation, and catalog effects remain suppressed. Cleanup is idempotent and processes the booking before the property while retaining the append-only PS-001D audit and reconciled ledger.

The blocked-run evidence remains legitimate milestone history and may be committed with the new candidate without changing the identity or outcome of the blocked `7197dec7` attempt.

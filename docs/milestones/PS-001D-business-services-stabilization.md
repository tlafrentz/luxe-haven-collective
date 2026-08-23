# PS-001D — Business + Services Stabilization

**Parent:** PS-001 — Platform v1 Customer Readiness Stabilization
**Prerequisites:** PS-001A baseline; PS-001B and PS-001C certified
**Type:** Stabilization / production-readiness gate
**Priority:** P0/P1
**Status:** Bounded correction in progress; local certification pending
**Feature freeze:** Active

## Objective

Certify the existing customer-facing Business and Services capabilities surrounding HPM: Properties, Bookings, Guest Communications, Reports, Connected Systems, Business Configuration, Guidebook Studio, and Furnishing Studio. PS-001D stabilizes what is already exposed; it does not activate FS-008, expand a service, add providers, offers, prices, catalog data, messaging, reports, or commerce behavior.

## Release invariants

- Customer, workspace, owner, user, and property identities remain canonical across every capability.
- Authentication, workspace authorization, entitlement, and capability authorization are separate server-enforced decisions.
- Every visible action is functional, explicitly disabled, or hidden.
- Provider state, empty state, degradation, and availability are evidence-backed.
- Historical report request context remains immutable.
- Direct URLs and server commands enforce the same authorization and entitlement rules as navigation.
- Production mutation requires the section 107 preflight and a single atomic PS-001D claim bound to the exact candidate, deployment, tenant, and correlation ID.
- Cleanup is a mandatory, deterministic, ledger-driven part of certification.
- The tested candidate, deployed application, verified source, closure commit, and tag target must form one identity chain.

## Production constraint

No production mutation is authorized until all baseline P0/P1 findings are resolved locally, the exact candidate passes every gate, preflight is recorded, an approved production Admin is verified, and the one-shot claim is acquired. Failed claim acquisition or preflight stops the run. A consumed claim is never reset after mutation.

## Definition of done

PS-001D remains incomplete until the full five-persona authorization and entitlement matrix, controlled Business/Services journeys, idempotency, privacy, responsive/accessibility, cleanup, post-cleanup audit, final engineering gates, evidence package, and annotated `PS-001D-complete` tag all pass. FS-008 and catalog activation must remain excluded and disabled.

# Luxe Haven Collective end-to-end release-readiness audit

Audit date: 2026-08-13  
Mode: audit-only, read-only with respect to application/external state  
Recommendation: **NO-GO**

## Executive conclusion

The platform compiles and its broad automated suite is healthy, but complete end-to-end release evidence does not exist. The canonical inventory contains 393 page/handler entry points and 688 statically discoverable controls. None received the required browser-plus-role-plus-persistence-plus-downstream evidence in this milestone because no controlled identities/browser harness were available and creating the necessary users, purchases, subscriptions, or provider resources was prohibited. Unknown items fail the requested completeness gate.

Complete coverage was **not achieved**. This report does not claim that a route works merely because it compiled, rendered during static generation, or has source/tests.

## Exact result totals

The audited-item denominator is 1,081: 393 route/runtime items plus 688 discovered control instances.

| Result | Total |
|---|---:|
| Passed | 0 |
| Failed | 0 |
| Blocked | 393 |
| Deferred | 0 |
| Untested | 688 |

Build compilation is recorded separately and is not counted as an end-to-end pass. Intentional product deferrals are catalog observations, not executed test items.

Defect totals: P0 0, P1 3, P2 4, P3 1. Of these, one is a confirmed code-quality defect, three are missing requirements/incomplete wiring, and four are test-environment blockers. See the defect register for classification.

## Coverage inventory

| Product area | Routes/handlers inventoried | Runtime result |
|---|---:|---|
| Admin | 114 | Blocked |
| Customer dashboard | 75 | Blocked |
| Public marketing / portal | 43 | Blocked |
| Investment Intelligence | 34 | Blocked |
| Guidebook Studio | 33 | Blocked |
| Furnishing Studio | 22 | Blocked |
| Reports | 18 | Blocked |
| Learn | 17 | Blocked |
| Commerce | 11 | Blocked |
| API / integration | 8 | Blocked |
| HPM | 8 | Blocked |
| Authentication | 5 | Blocked |
| Actions / Execute | 5 | Blocked |

Role coverage: anonymous route compilation only; prospective customer, customer without HPM, HPM, Guidebook-only, Furnishing, Investment, owner, admin, cleaner/assignee, and wrong-tenant runtime tests were blocked. Viewport coverage: no browser viewport passed; desktop and mobile remain required. Workflow and state coverage: unit/component evidence exists, but no complete authenticated E2E workflow was credited.

## Automated evidence

- `npm test -- --reporter=verbose`: PASS — 712 files, 3,861 tests.
- `npm run typecheck`: PASS.
- `npm run build`: PASS — optimized Next.js build; 273 static pages generated and 393 inventory entry points discovered from source.
- `npm run migration:lint`: PASS — no findings (rerun with permission only to allow local IPC).
- `npm run lint`: PASS with one warning (`AUD-007`).
- `npm audit --omit=dev --audit-level=high`: BLOCKED — restricted DNS could not reach the npm advisory service.
- Hosted Supabase, production reporting, identity bootstrap, customer provisioning, catalog registration, candidate locking, and controlled-purchase scripts were not run because their names/source show external reads with possible writes or explicit provisioning/registration effects.

The test suite provides valuable domain, component, migration-text, authorization-policy, idempotency, concurrency, and accessibility evidence. It does not replace browser execution against deployed infrastructure.

## Commerce safeguards

Source defines the approved HPM, Guidebook, Furnishing, and Investment offers, including monthly/annual variants and add-ons; migrations include advisory locking/idempotency and deferred-catalog filtering. The catalog read model forces checkout unavailable when active price mappings do not exactly match active price versions. This is positive design evidence only.

The repository itself states that approved live Stripe Products and Prices have not yet been reconciled to every approved price version. Therefore all 18 mapping checks, test purchases, renewals, cancellation/portal behavior, delayed hosting renewal, furnishing approval/credit behavior, webhook fulfillment, and concurrent Investment credit consumption remain blocked. No Stripe API call or purchase was made. Deferred/publication/tax-registration safeguards were not changed.

## Production versus local evidence

Local evidence: source inventory, migrations/RLS text, navigation/control discovery, automated tests, lint, typecheck, migration lint, and production build. Production evidence: only previously committed release documents were reviewed; no new production query or external-provider interaction was performed. Prior production statements are historical evidence, not a fresh pass.

## Quality and security observations

No full link crawl, hydration/console/network capture, screenshot comparison, keyboard traversal, responsive overflow check, measurable contrast run, layout-shift measurement, or authenticated metadata review was possible. Existing targeted component accessibility tests passed inside the 3,861-test suite. Secrets and environment values were never printed; only environment filenames were inventoried.

## Intentional deferrals and unavailable items

The offer catalog has explicit deferred launch states and its published read function excludes them. Automation release tests assert flags default off and promotion requires approval. These are static/automated safeguards, not deployed-state proof. Do not publish or enable them until the remediation exit criteria are met.

## Evidence map

- `end-to-end-route-inventory.csv`: every discovered page/handler, expected role, build evidence, runtime disposition, and source.
- `end-to-end-control-matrix.csv`: controls discovered directly in route source, required viewport/behavior, result, and blocker.
- `end-to-end-tested-manifest.json`: machine-readable routes, roles, controls, results, and totals.
- `end-to-end-defect-register.csv`: prioritized findings and classifications.
- `scripts/audit/generate-end-to-end-audit.mjs`: reusable, non-destructive inventory generator.

## Release gate

NO-GO is mandatory because primary commerce/entitlement workflows and authorization boundaries lack end-to-end evidence, all 18 production price mappings lack fresh attestation, and 1,081 audited items are blocked or untested. Follow the prioritized remediation plan and rerun the audit in a disposable production-shaped environment.

# PS-001B — Production Verification

**Result:** Passed

**Verified:** 2026-08-23

**Application commit:** `91adc182`

**Production deployment:** `dpl_8oigBrnep6bsLXyTf2rc58rSCBfh`

**Production alias:** `https://luxehavencollective.co`

**Evidence correlation:** `ps001b-61d61f0a-c71e-4d29-8e84-87d9645d95ef`

## Candidate and deployment

The controlled verification ran against application commit `91adc182` on deployment `dpl_8oigBrnep6bsLXyTf2rc58rSCBfh`. The deployment was healthy and the required database migration state was current. No replacement deployment was created during the final verification run.

## Controlled matrix

| Surface | Result |
| --- | --- |
| Complete evidence | Passed with controlled revenue, expense, cash, booking, and property evidence |
| Partial evidence | Passed after removing controlled expense evidence; missing evidence remained explicit and was not rendered as zero |
| Degraded evidence | Passed with stale controlled cash evidence; last reliable data remained visible with degraded provenance |
| Authorized owner | Passed for the controlled owner workspace and property |
| Administrator | Passed with authorized administrative access |
| Wrong tenant | Passed; controlled property evidence did not cross the tenant boundary |
| Anonymous | Passed; authentication boundary enforced |
| Revoked user | Passed; suspended membership was denied with a customer-safe access state |

## Browser journeys

- Observe passed: Revenue Intelligence → report handoff/artifact → Financial Intelligence → Cash Flow → Forecast → Data Sources.
- Executive passed: Executive Intelligence → Attention → Performance/Risk/Data Quality filters → Back/Forward → return.
- Portfolio passed: Portfolio → Property Intelligence → return → Properties → Supporting Signals → Data Quality.
- Evidence degradation passed across the controlled complete → partial → stale transition without fabricated provider states or raw failures.

Shared workspace, scope, 2026-08 reporting period, July comparison period, and actual basis survived the applicable navigation and reporting transitions.

## Report artifact inspection

Both Revenue Intelligence intents generated ready canonical report artifacts and were opened in Reports:

| Intent | Report | Version | Generated |
| --- | --- | --- | --- |
| Current view | `3f3f0c3b-05c9-4b8f-8716-1512a38591c3` | `61918088-6a5b-42f2-8160-2705ba222a38` | 2026-08-23T18:38:12.732Z |
| Full capability | `e6a37101-0700-4f5b-85a4-00d25abe2eab` | `b5d1dec0-0757-47d4-b5b6-0bf3b40c9322` | 2026-08-23T18:38:24.563Z |

The persisted immutable request snapshots were inspected directly. They retained the authorized workspace/scope, 2026-08-01 through 2026-08-31 period, 2026-07-01 through 2026-07-31 comparison, actual basis, Revenue/Overview source, generation timestamp, and distinct current-view/full-capability intent. Rendering used those stored snapshots. The synthetic report rows were removed after inspection; their identifiers and screenshots remain in the audit evidence.

## Responsive verification

Desktop (1440×900), tablet (820×1000), and mobile (390×844) passed with the same intelligence hierarchy and functional responsive navigation.

## Retained evidence

The final JSON record and screenshots are retained under [`docs/evidence/PS-001B/ps001b-61d61f0a-c71e-4d29-8e84-87d9645d95ef`](../evidence/PS-001B/ps001b-61d61f0a-c71e-4d29-8e84-87d9645d95ef/verification.json). They include complete, partial, and degraded evidence; Attention filtering; Property Intelligence; Supporting Signals; Portfolio Data Quality; both report artifacts; Financial data sources; and all three responsive sizes.

## Cleanup

The controlled owner, administrator, wrong-tenant user, revoked user, workspaces, memberships, property, bookings, financial records, and generated report records were removed in the harness `finally` path. The final evidence record confirms `synthetic-cleanup-completed`. Superseded failed-run evidence directories were removed; only the final passing package is retained.

## Final engineering gates

- Tests: **4,129/4,129 passed** across 755 files.
- Typecheck: passed.
- Lint: passed with zero errors (three pre-existing/non-blocking warnings).
- Production build: passed; 282 static pages generated and build traces completed.
- Controlled production matrix: passed.
- Known P0/P1 Observe or Understand defects: none.

## Known limitations and backlog

PS-001B added no product scope. Broader provider monitoring remains a post-close operational backlog item and does not reopen Financial Intelligence or this milestone.

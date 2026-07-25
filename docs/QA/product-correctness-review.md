# PI-UX-002A Product Correctness Review

Review source: 30-item operator review, July 2026  
Scope: correctness, status truth, functional workflows, comparisons, and placeholders

## Implemented trust controls

| Review items | Finding | Control |
| --- | --- | --- |
| 3 | Booking rows did not select | Entire row is keyboard- and pointer-selectable; navigation retains filters, creates history, and focuses reservation detail. |
| 9, 12, 13 | Vague issues and degraded health | Workspace Health emits a concrete operational data-quality issue with impact and recovery. Healthy synchronization is not independently labeled degraded. |
| 15 | `$0` contradicted booking and ADR | Contradictory zero gross revenue renders `Unavailable` with synchronization explanation. |
| 16 | Comparison context hidden | Analytics report context names the current reporting period and `Previous period`; Portfolio controls expose previous period, previous year, or none. |
| 18 | Generic unavailable state | Status policy requires missing-data, disconnected-provider, disabled-feature, and authorization causes to remain distinct. |
| 19 | Occupancy exceeded 100% | Shared overlap calculation counts only in-period nights and canonical occupancy is capped at 100%. |
| 21, 26–28 | Production-looking placeholders | Saved Scenarios remains disabled; Reports and Guest Communications are explicitly Preview, with illustrative-data notices and disabled primary actions. |
| 22 | Analysis/save dead end | Save Opportunity remains disabled until a current analysis exists and explains the prerequisite; analysis failures retain their concrete missing-evidence reason. |
| 23 | Generic Pending | Investment preview now says `Awaiting analysis`; booking quality says `Awaiting analysis`. |
| 29 | Extreme comparison percentages | Zero baselines produce `New measurement`; near-zero baselines produce `Comparison unavailable`. Executive and Portfolio consumers preserve suppression. |

## Review findings assigned to PI-UX-002B

Items 1, 2, 5, 6, 10, 14, 17, 20, 24, and 30 are visual alignment, density, wrapping, or interaction-refinement findings. They are documented but excluded by PI-UX-002A's no-redesign boundary.

Items 4, 11, and 25 require separate product-flow or navigation investigation and are not represented as metric/status trust defects in this sprint.

## Verification matrix

- Unit: canonical occupancy, overlap, ADR, RevPAR, comparisons, aggregation, status derivation.
- Application: booking selection contract, opportunity prerequisites, analysis failure guidance.
- Presentation: unavailable revenue, comparison suppression, Preview notices, disabled primary actions.
- Regression: analytics, Executive, Portfolio, Investment, Workspace, Home.
- Release: lint, typecheck, Vitest, production build, `git diff --check`.

Production smoke validation additionally requires authenticated provider-backed data and deployed runtime logs. No temporary provider records are created by this review.


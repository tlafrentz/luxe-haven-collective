# PS-001C Read-Only Baseline Audit

**Audit state:** Initial inventory complete; bounded correction in progress  
**Authority:** `PS-001C-decide-execute-learn-stabilization.md`

| Surface | Expected customer contract | Baseline implementation | Canonical capability | Classification | Disposition |
|---|---|---|---|---|---|
| Investment navigation | Overview, Analyze, Scenarios, Opportunities; one New Analysis | Canonical tabs present; Reports/Settings compatibility routes exist but are not tabs | Investment shell and route registry | Legacy UI / regression floor | Keep compatibility redirects unlinked; retain regression tests |
| Decision approval | Record a decision without silently assigning execution | Approval also created draft actions | Decision service plus separate plan service | Domain integration defect | Removed automatic action creation; explicit plan handoff required |
| Decision → plan | Hydrate one canonical draft plan and preserve decision lineage | Service existed but customer handoff was not explicit | Execute plan service | Missing command wiring | Expose explicit idempotent Create Action Plan handoff |
| Action Center views | Five intentional functional views | Five views; existing regression asserts Recurring absent | Action Center query projection | Intentionally not exposed | Keep Recurring absent and certify five views |
| Action Plan cards | Open canonical plan management when cards imply navigation | Cards appeared actionable but were inert | Execute plan detail, history, update, activation services | Missing navigation / presentation | Add canonical plan detail and links |
| Action detail | Evidence, blocker, dependency, review, correction, retry/reopen only when policy authorizes | Customer used a reduced Action Center projection | Canonical Execute action-detail projection and command service | Projection mismatch | Compose customer detail from canonical projection and commands |
| Review-required action | Valid evidence can be submitted for review | Projection suppressed Submit for review when review was required | Execute transition service correctly enforces review | Domain projection defect | Correct inverted projection condition; permanent regression test |
| Outcome detail lineage | Reach recorded action, plan, and decision sources | Outcome view omitted recorded measurement-plan lineage | Measurement plan stores source IDs | Missing presentation | Render canonical source links; infer nothing when absent |
| Outcome vs learning | Measurement and organizational learning remain separate | Canonical boundaries are separate | Outcome reviews and validated learning versions | Regression floor | Preserve positive and required negative tests |
| Scenario outcome page | Measure projected versus actual without claiming canonical learning | Page labeled derived variance text as Structured lessons | Scenario projection is decision support, not validated Learning | Misleading presentation | Relabel as interpretation candidates and disclose policy boundary |
| Decision active navigation | Decision detail is owned by Decide | `/dashboard/portfolio/decisions/*` inherited Understand | Shared navigation supports pattern ownership | Navigation defect | Assign decision paths exclusively to Decide without route replacement |
| Learn links | Canonical `/dashboard/learn/*` customer destinations | Some links used `/dashboard/learning/*` compatibility paths | Canonical Learn routes exist | Legacy navigation | Replace customer links; retain compatibility routes only where needed |

## Scope conclusions

- The underlying Execute domain is richer than the customer projection. That difference alone is not authorization to expose every capability.
- Blockers, dependencies, correction, retry, reopen, and evidence appear only when canonical authorization and valid-command projection expose them.
- Recurring remains internal/not exposed.
- No new lifecycle, state machine, reporting product, or execution engine is required.

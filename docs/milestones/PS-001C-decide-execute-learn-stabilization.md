# PS-001C — Decide + Execute + Learn Stabilization

**Parent:** PS-001 — Platform v1 Customer Readiness Stabilization  
**Prerequisites:** PS-001A and PS-001B certified  
**Type:** Stabilization / production-readiness gate  
**Priority:** P0/P1  
**Status:** Certified — production verification passed 2026-08-23
**Feature freeze:** Post-close stabilization freeze

## Objective

Certify the second half of the HPM lifecycle:

```text
Understand → Decide → Execute → Learn
Opportunity → Decision → Action Plan → Action → Outcome → Learning
```

A controlled authorized customer must be able to make a traceable decision, deliberately hand it to Execute, complete authorized work with required evidence and review, observe and measure an outcome, and establish learning only when the canonical evidence policy permits. The system must preserve the distinction between deciding, doing, measuring, and learning.

## Canonical customer scope

- Decide: Investment Intelligence with exactly Overview, Analyze, Scenarios, and Opportunities; no Reports or Settings tabs; exactly one New Analysis action.
- Execute: Action Center with the approved five customer views: Overview, My Work, All Actions, Action Plans, and Completed.
- Learn: currently exposed canonical outcomes, measurement states, lessons, experiments, improvement evidence, and lineage.
- Recurring remains absent from customer navigation. Its underlying domain capability does not authorize a customer tab.
- Richer domain capabilities are exposed only when an approved requirement designates them customer-facing, existing UI promises them, or the primary workflow cannot complete without them.

## Hard contracts

- Opportunity identified is not Decision made. Decision made is not automatic execution.
- Decision-to-plan handoff preserves source decision, scope, rationale, and evidence references and never requires duplicate entry of known context.
- A draft plan creates no execution until canonical activation. Activation is authorized, versioned, transactional, dependency-validated, and idempotent.
- Customer action detail is composed from canonical Execute projections and commands. Presentation never duplicates lifecycle rules.
- After every customer-visible Execute command, certification must reload the persisted canonical Execute projection and assert that the rendered state agrees with it. A transient optimistic UI success is not evidence of a successful command.
- Completion cannot bypass evidence, dependencies, blockers, review, or authorization.
- Action completed is not Outcome measured. Outcome measured is not Learning established.
- Estimated impact never becomes realized impact through completion. Only supported measurement can establish realized impact.
- Historical assumptions, rationale, plan versions, due dates, evidence, measurement windows, outcomes, and learning are immutable with respect to current shared viewing context.
- Missing or unsupported evidence is never rendered as zero, success, or reusable learning.
- Current context controls what is viewed; it does not rewrite historical object meaning.
- Wrong-tenant, anonymous, and revoked identities fail closed for both reads and mutations.
- Browser replay, scheduler replay, and command retry do not create duplicate canonical business objects or notifications.
- Customer errors use domain states such as Incomplete, Conflict, Blocked, Access denied, Not found, or Recoverable failure. Raw exception, SQL, RPC, and stack details are never customer copy.

## Baseline-controlled correction policy

Every gap is classified as missing presentation, missing navigation, missing command wiring, projection mismatch, authorization defect, domain defect, legacy UI, intentionally not exposed, or future scope. A correction must identify the failed requirement, remain bounded, name affected rerun surfaces, and disclose whether canonical domain behavior changes. Product-contract expansion stops and moves to backlog.

P0 and P1 findings block certification. Bounded P2 corrections are allowed when they do not expand scope. P3 findings are backlog. Impact-based reruns are allowed, but authorization, lineage, lifecycle-state, shared-mutation, or outcome/learning-policy changes require broader regression.

## Required controlled proofs

1. Successful measured lifecycle: Opportunity → Decision → Plan → Action → Completion → Measured Outcome → Learning.
2. Completion without measurement: completed action → measurement pending → no learning.
3. Inconclusive outcome: measured evidence is inconclusive → retained outcome → no reusable learning.
4. Correction path: evidence → review → return for correction → resubmit → complete.
5. Estimated versus realized: an estimated benefit remains not-yet-measured after action completion.
6. Backward lineage: Learning → Outcome → Action → Action Plan → Decision → Opportunity → evidence, with absent links represented honestly.
7. Authorization and mutation matrix: controlled owner, controlled admin, wrong tenant, anonymous, and revoked user.
8. Replay/idempotency, conflict, browser history, deep links, desktop/tablet/mobile, and bounded accessibility verification.

## Local and candidate gates

Before deployment: full suite, focused PS-001C regressions, typecheck, lint with zero errors, production build, migration current-state validation, `git diff --check`, route inventory, action inventory, and unrelated-diff review must pass.

Certification uses one immutable production commit. Record commit, deployment ID, alias, migration state, test count, controlled identities/workspace, exact permissions, synthetic IDs, correlation IDs, matrices, screenshots, cleanup result, and known limitations. The harness aborts on any controlled-identity mismatch.

Evidence belongs in `docs/evidence/PS-001C/<verification-run-id>/`; the final narrative belongs in `docs/milestones/PS-001C-production-verification.md`. Never retain synthetic credentials.

## Definition of done

PS-001C closes only when all positive and negative lifecycle proofs pass in production; every approved route and visible control is intentional and functional; no unresolved P0/P1 remains; local gates are green; responsive and accessibility blockers are cleared; evidence is retained; synthetic cleanup is complete; and the annotated `PS-001C-complete` tag and final main commit are pushed and verified.

## Explicit non-goals

No customer Recurring tab, automation policy, decision model, lifecycle stage, outcome model, learning model, Investment Intelligence feature, Action Center capability, generalized project management, report product, notification channel, AI agent, or visual redesign is authorized.

**Release principle:** Stabilize the lifecycle that exists. Do not invent the lifecycle we may want later.

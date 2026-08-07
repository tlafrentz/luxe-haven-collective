# GS-V1D Mesa Production Certification

Status: **NOT CERTIFIED**  
Audit date: 2026-08-06

GS-V1D is a release gate. Passing unit tests or rendering a storyboard is not sufficient. Certification requires recorded evidence from the real customer and admin workflows using the actual Mesa reference PDF and application UI.

## Current evidence

| Gate | Status | Evidence |
|---|---|---|
| Customer property and guidebook creation | Partially implemented | `/dashboard/guidebooks/new` supports canonical property creation, but has not been executed against a production-like authenticated workspace. |
| Admin parity | Partially implemented | Admin Builder and Publish routes exist; the Admin new-guidebook route does not yet run the same four-step creation workflow. |
| Builder component authoring | Partially implemented | Versioned draft component instances, inline fields, variables, ordering, duplication, visibility, and layout persist through revision-aware commands. |
| Content Library binding | Failed | Inspector affordance exists, but canonical record search/select/detach is not wired to persisted commands. |
| Media Library binding/upload | Failed | Inspector affordance exists, but canonical media search/upload/select is not wired. |
| Canonical property variables | Failed | Draft schema can persist bindings, but Builder preview currently contains Mesa example replacements instead of loading the canonical property projection. |
| Immutable web publication | Implemented, not production-validated | Existing publication RPC creates version snapshots; `/stay/[slug]` reads only the active published snapshot. |
| PDF from snapshot | Failed | No production PDF renderer or download route is configured. The Publish screen correctly reports this channel unavailable. |
| QR from snapshot destination | Implemented, not production-validated | Authorized QR route targets the active public slug, but the full Mesa lifecycle has not been executed. |
| Publish V1 → edit → publish V2 | Not run | Requires an authenticated test workspace and fully authored Mesa guidebook. |
| Historical V1 remains immutable | Domain-tested, not end-to-end validated | Snapshot delivery/history boundaries exist; production lifecycle evidence is absent. |
| Actual Mesa PDF visual/content parity | Benchmark registered; validation not run | The supplied 18-page, 31,355,292-byte PDF is registered under SHA-256 `a7e1f78b061cc1169b0996fc5cf35ab5e16c21f409ae9088f07ed7be00a1774d`. Page-by-page UI recreation and visual comparison evidence are still required. |
| Customer/Admin browser E2E | Blocked | No Playwright/Cypress dependency, authenticated test identities, or E2E environment configuration exists. |

## Required evidence package

Certification must record:

1. The exact Mesa benchmark PDF and an approved asset manifest.
2. Customer and admin test identities scoped to a disposable certification workspace.
3. Browser recordings or traces for create → author → preview → publish → guest → revise → republish.
4. Snapshot identifiers for publication versions 1 and 2.
5. Hashes of the web, PDF, and QR artifacts generated from each snapshot.
6. Proof that editing the draft after V1 does not alter V1 artifacts.
7. Accessibility results for keyboard operation, headings, links, contrast, and image alternatives.
8. Cross-workspace and anonymous authorization results.

## Release rule

Use `evaluateMesaProductionCertification` as the final binary gate. Every declared check needs positive, specific evidence. Missing evidence and recorded failures both produce `not-certified`. Seeded guidebook JSON, direct guidebook database writes, and developer-only insertion scripts are not acceptable evidence.

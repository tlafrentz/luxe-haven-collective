# PS-001D Read-Only Baseline Audit

**Audit date:** 2026-08-23
**Audit state:** Complete; implementation remains frozen pending bounded correction
**Authority:** `PS-001D-business-services-stabilization.md`

No application code, schema, provider state, entitlement, production configuration, or customer data was changed during this audit.

## Capability inventory

| Capability | Current customer routes | Visible workflow/actions | Canonical boundary | Entitlement / authorization observed | Completeness | Classification |
|---|---|---|---|---|---|---|
| Properties | `/properties`, `/properties/new`; compatibility workspace properties route | List, selected operational detail, report handoff, Add Property choice, manual create, provider-import handoff | Canonical `properties` plus workspace membership | Route requires authentication; operational projection currently receives profile ID as workspace ID | Partial; add-method UX is correct, scope is not | Projection/authorization defect |
| Bookings | `/bookings`; `/dashboard/bookings` redirects | List/detail-in-workspace, filters, property/guest context, quality/degradation | Bookings and reservation-context read boundaries | Booking repository correctly receives profile ID and resolves ownership internally; shared reservation context previously used profile ID as workspace ID | Partial; truthful states exist, shared context required correction | Projection defect |
| Guest Communications | `/dashboard/communications`, conversation and guest-history routes | Search/filter, conversation, reply where capability allows, provider review association, connection handoff | Guest communication inbox/conversation commands and canonical reservation/property context | Server actions evaluate workspace permissions and scoped objects | Substantial; production persona/privacy proof outstanding | Verification gap / possible presentation defect |
| Reports | `/dashboard/reports` and canonical detail/version routes | List, filters, generate, immutable version view, download, archive/share/regenerate where authorized | Canonical Reporting request, snapshot, artifact, and audit boundaries | Authentication plus report capability/entitlement checks in commands | Substantial; immutable snapshot contract is implemented | Verification gap |
| Connected Systems | `/dashboard/workspace/connected-systems` | Provider status, manage/sync/reconnect/disconnect where projected; return-to-origin | Canonical workspace provider connections and mappings | Workspace context and `connections.manage` permission | Partial; return target accepts Observe only | Routing defect |
| Business Configuration | `/dashboard/workspace/*`, `/dashboard/settings` compatibility | Organization, team, preferences, properties, connections, notifications | Workspace membership/configuration boundaries | Page-specific workspace access context | Broad but fragmented; duplicate Settings compatibility needs route classification | Legacy UI / route audit |
| Guidebook Studio | `/dashboard/guidebooks`, local Guidebooks/Templates/Brand Kit, guidebook/builder/publish routes | List, create, property creation/selection, extraction/draft paths, edit, preview, review/publish subject to rights | Canonical Guidebook, canonical property, Guidebook entitlement projection | Server requests enforce workspace permissions and Guidebook create/publish/host rights; global nav intentionally remains visible as an availability/upgrade surface | Substantial; entitlement and no-HPM production proofs outstanding | Verification gap |
| Furnishing Studio | `/dashboard/furnishing/projects`, new/detail/procurement/installation routes | List, create/resume, property creation/selection, plan/design/selections/budget/review/procurement/install controls | Canonical `properties`, `furnishing_projects`, plans, selections, offers, budgets | Navigation requires `furnishing.project.access`; server pages/actions currently check membership/role but not entitlement | Unsafe direct-route access | Entitlement defect |

## Baseline findings

### PS001D-P0-001 — Furnishing entitlement is not enforced at the server boundary

The shared navigation hides Furnishing Studio unless `furnishing.project.access` is present, but customer Furnishing routes call server components/actions that authorize only authentication, administrator role, or active workspace membership. `getProjectSetup`, `listProjectWorkspaces`, project reads, property creation, project creation, and subsequent commands do not establish the service entitlement before reading or mutating data.

This is a direct-URL and direct-command entitlement bypass under sections 48, 49, 59–61, and 99. It blocks implementation certification and must be corrected before any production mutation.

### PS001D-P1-001 — Properties resolves the wrong workspace identity

`/properties` constructs the operational principal with `workspaceId: user.id`. The canonical workspace is an `owners.id` selected through active `workspace_memberships`; it is not generally the authenticated profile ID. This can produce an empty or incorrect projection and contradicts cross-capability property identity.

Required bounded correction: resolve the canonical active workspace context and pass its workspace ID and authorized property scope to the existing operational projection. Do not create a second property model.

### PS001D-P1-002 — Bookings resolves the wrong workspace identity

`/bookings` correctly passes `user.id` to the Booking repository because that port accepts a profile ID and resolves authorized ownership internally. However, it also passed `user.id` as the workspace identifier to reservation-context reads, quality evaluation, and shared context, which can make Bookings disagree with the rest of the workspace.

Required bounded correction: retain the profile-based Booking repository port while composing reservation and shared context from the canonical active workspace.

### PS001D-P1-003 — Properties import cannot deterministically return to Properties

The Add Property choice correctly links provider import to Connected Systems with `returnTo=/properties`. Connected Systems currently accepts a return target only when it starts with `/dashboard/observe/`, so it discards the Properties origin. This violates the explicit return-to-origin contract.

Required bounded correction: validate return targets through the canonical route registry/allowlist and permit the Properties import origin without accepting arbitrary redirects.

### PS001D-P1-004 — Furnishing duplicates canonical property-creation policy

Furnishing embeds a separate property form and inserts directly into `properties`, including its own required-field defaults, address duplicate query, and a `createAnyway` override. Although it writes the canonical table rather than a Furnishing-specific table, it duplicates property creation and duplicate-resolution rules instead of using the canonical Property application boundary.

Required bounded correction: make both Business and Furnishing flows use one canonical property creation command/policy while preserving the existing supported fields and deterministic return target.

### PS001D-P1-005 — Furnishing error presentation can expose infrastructure details

Several customer-reachable Furnishing actions throw raw database error messages (`error.message`). Unless intercepted and sanitized elsewhere, ordinary failures can surface Supabase/Postgres implementation details, contrary to the error contract.

Required bounded correction: map customer commands to stable domain-safe results/messages while retaining correlation in server logs.

### PS001D-P1-006 — Business/Services route registry is incomplete

The central registry includes Properties, Add Property, Bookings, communications, Reports root, Guidebook root/create/editor and local routes, and Furnishing root. It does not classify the full exposed report detail/version/share routes, Guidebook setup/edit/compose/publish/share/version routes, or Furnishing project/new/detail/procurement/installation routes required by section 97.

Required bounded correction: register exposed canonical/redirect/fixture routes without introducing a new router.

### PS001D-P2-001 — Properties empty-state copy implies provider import is required

The Properties empty state says to import from a connected hospitality platform even though the same page correctly supports manual creation. Update the bounded copy to explain both valid paths.

### PS001D-AUDIT-001 — Guidebook navigation exposure needs policy confirmation, not automatic removal

Guidebook Studio is globally visible without a navigation entitlement, while its server projection enforces workspace permission and Guidebook rights and renders an upgrade/not-enabled state. This may be the intentional visible-upgrade policy permitted by PS-001D. Keep it unchanged unless the canonical product policy says Guidebook must be hidden when not entitled; production must still prove direct-route enforcement and the Guidebook-without-HPM case.

### PS001D-AUDIT-002 — Communications provider-review presentation requires customer-role proof

The inbox can display provider association-review metadata and an association command when `canReviewProviderMessages` is true. The underlying command is permission checked, but production must confirm ordinary customers never receive internal provider diagnostics or operational controls and that degraded source state is distinct from an empty inbox.

## Existing strengths retained

- Add Property already separates manual creation from provider import.
- The portal routes use the shared application shell; Properties and Bookings are not standalone legacy shells.
- Guidebook Studio uses local in-content navigation and preserves the AI draft/human review/no-auto-publish trust contract.
- Guidebook server projections distinguish permissions from create/publish/host entitlements and preserve published experiences when access changes.
- Reporting persists scope, period, source context, and projection snapshots and renders exact immutable versions.
- Report downloads use authorized short-lived artifact URLs rather than page printing.
- Guest Communications has a real permission-gated reply command and represents queued/accepted/delivery-failed states rather than an inert Send control.
- Furnishing references canonical property IDs and distinguishes product selections from retailer offers, but its property command and entitlement boundary require correction.
- Navigation already keeps Recurring absent and FS-008/catalog activation is not part of these customer routes.

## Correction boundary and required reruns

Only the six P0/P1 findings above and the bounded P2 copy issue are authorized for correction. The entitlement fix requires the Furnishing route/action authorization, five-persona, direct-link, and entitlement matrices. The shared workspace and property corrections require Properties, Bookings, Guidebook/Furnishing property handoffs, wrong-tenant access, and duplicate/idempotency reruns. The Connected Systems change requires origin validation, browser return, and open-redirect regression coverage. Registry additions require route smoke/deep-link coverage. Error mapping requires customer presentation and server log/correlation checks.

No baseline finding authorizes FS-008, catalog activation, new service functionality, new provider behavior, pricing, offers, expanded messaging, or report types.

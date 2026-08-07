# GS-999B — Guidebook Studio v1 Release Readiness Checklist

Status: **NOT READY / NOT CERTIFIED**  
Companion scenario: [GS-999A](./GS-999A-launch-validation-storyboard.md)

Use `[x]` only when the evidence link or identifier is recorded beside the item. “Implemented,” “tested locally,” and “expected to work” are not production evidence.

## Release metadata

- Release commit:
- Deployment identifier:
- Production URL:
- Database migration version:
- Mesa property ID:
- Mesa guidebook ID:
- V1 snapshot ID/hash:
- V2 snapshot ID/hash:
- Evidence package location:
- Incident/support runbook version:

## Product and customer lifecycle

- [ ] Production purchase grants Guidebook Studio entitlement. Evidence:
- [ ] Account and workspace creation complete without engineering. Evidence:
- [ ] Guidebook-only customer sees Get Started. Evidence:
- [ ] Existing-property path passes. Evidence:
- [ ] New canonical property path passes. Evidence:
- [ ] Duplicate detection passes. Evidence:
- [ ] Exact Mesa Modern template version persists. Evidence:
- [ ] Draft and complete starter sections are created. Evidence:

## Builder and authoring

- [ ] Customer Builder loads and enforces permissions. Evidence:
- [ ] Admin uses the same engine in selected customer context. Evidence:
- [ ] Autosave, failure, conflict, offline, and resume pass. Evidence:
- [ ] Section create/rename/reorder/duplicate/visibility/remove pass. Evidence:
- [ ] Required component subset persists through the UI. Evidence:
- [ ] Inline rich content authoring passes. Evidence:
- [ ] Canonical Content Library search/select/detach passes. Evidence:
- [ ] Canonical Media Library search/upload/select/alt text passes. Evidence:
- [ ] Canonical property variables resolve with missing-value recovery. Evidence:
- [ ] Mesa recommendations, FAQ, rules, and departure content are complete. Evidence:
- [ ] No guidebook content was inserted directly into the database. Evidence:

## Preview and publishing

- [ ] Desktop preview visually approved. Evidence:
- [ ] Tablet preview visually approved. Evidence:
- [ ] Mobile preview visually approved. Evidence:
- [ ] Blocking validation prevents publication. Evidence:
- [ ] Warnings remain actionable and non-blocking. Evidence:
- [ ] Immutable V1 snapshot is created atomically. Evidence:
- [ ] Responsive artifact derives from V1 snapshot. Evidence:
- [ ] Real PDF artifact derives from V1 snapshot. Evidence:
- [ ] QR artifact derives from V1 snapshot destination. Evidence:
- [ ] Partial publishing failure never activates partial output. Evidence:
- [ ] Publication history records actor, version, date, and channels. Evidence:

## Guest experience

- [ ] Anonymous `/stay/luxe-haven-mesa` loads the active snapshot. Evidence:
- [ ] Draft data is never exposed anonymously. Evidence:
- [ ] Navigation and quick actions work. Evidence:
- [ ] Wi-Fi values render correctly and sensitive values follow policy. Evidence:
- [ ] Recommendations, FAQ, departure, and review CTA work. Evidence:
- [ ] Images, links, typography, spacing, and buttons match the benchmark. Evidence:
- [ ] Production QR opens the correct mobile route. Evidence:

## Revision lifecycle

- [ ] Draft edit after V1 leaves V1 web/PDF/QR unchanged. Evidence:
- [ ] Validation and publish produce V2. Evidence:
- [ ] Guest receives V2 immediately after activation. Evidence:
- [ ] V1 remains immutable in history. Evidence:
- [ ] Rollback/restore behavior is documented and tested. Evidence:

## Environments and deployment

- [ ] Development, staging, and production resources are isolated. Evidence:
- [ ] Production database migrations applied and verified. Evidence:
- [ ] Storage buckets, CDN, routing, auth, and secrets verified. Evidence:
- [ ] Deployment rollback tested. Evidence:
- [ ] Post-deployment smoke test passes. Evidence:
- [ ] Working tree and release commit are reproducible. Evidence:

## Security

- [ ] Customer owner and authorized member permissions verified. Evidence:
- [ ] Read-only denial verified. Evidence:
- [ ] Admin customer-context authorization verified. Evidence:
- [ ] Cross-workspace access denied for property/content/media/guidebook. Evidence:
- [ ] Anonymous access exposes only active published snapshots. Evidence:
- [ ] RLS verified against production schema. Evidence:
- [ ] Sensitive values excluded from telemetry and support output. Evidence:

## Accessibility and compatibility

- [ ] WCAG 2.2 AA automated audit passes. Evidence:
- [ ] Keyboard creation, Builder, dialogs, reordering, and publishing pass. Evidence:
- [ ] Focus restoration and live announcements pass. Evidence:
- [ ] Alt text/decorative policy passes. Evidence:
- [ ] Heading structure, link names, contrast, and screen-reader smoke test pass. Evidence:
- [ ] Chrome, Safari, Edge, Firefox pass. Evidence:
- [ ] Mobile Safari and Chrome Android pass on physical devices. Evidence:

## Performance

- [ ] Builder interaction target defined and met. Evidence:
- [ ] Preview target defined and met. Evidence:
- [ ] Publish duration target defined and met. Evidence:
- [ ] Guest Web Vitals target defined and met. Evidence:
- [ ] Responsive image/CDN behavior verified. Evidence:

## Operations, monitoring, and recovery

- [ ] Save-failure monitoring and alert tested. Evidence:
- [ ] Publication-failure monitoring and alert tested. Evidence:
- [ ] Media processing/storage monitoring and alert tested. Evidence:
- [ ] QR generation alert tested. Evidence:
- [ ] Guest route availability alert tested. Evidence:
- [ ] Guidebooks, content, templates, and media backup verified. Evidence:
- [ ] Restore and republish exercise passes. Evidence:
- [ ] Recovery objectives are documented and approved. Evidence:
- [ ] Customer support can locate workspace, draft, active version, and failures. Evidence:

## Documentation

- [ ] Customer Getting Started guide published. Evidence:
- [ ] Create Guidebook guide published. Evidence:
- [ ] Builder guide published. Evidence:
- [ ] Publishing and Guest Portal guide published. Evidence:
- [ ] Customer FAQ published. Evidence:
- [ ] Internal troubleshooting and known-issues guide published. Evidence:
- [ ] Publishing, media, backup, recovery, and incident runbooks approved. Evidence:

## Engineering quality gates

- [ ] Unit tests pass at release commit. Evidence:
- [ ] Integration tests pass at release commit. Evidence:
- [ ] Customer and admin browser E2E pass. Evidence:
- [ ] Lint passes. Evidence:
- [ ] Typecheck passes. Evidence:
- [ ] Production build passes. Evidence:
- [ ] `git diff --check` passes. Evidence:
- [ ] Database migration verification passes. Evidence:
- [ ] Production deployment succeeds. Evidence:
- [ ] Production smoke test succeeds. Evidence:

## Required approvals

- [ ] Product:
- [ ] Engineering:
- [ ] QA:
- [ ] Customer Success:
- [ ] Security:
- [ ] Operations:

## Launch decision

- [ ] No critical defects remain.
- [ ] No major defects remain.
- [ ] Every required gate above has evidence.
- [ ] GS-V1D Mesa production certification is complete.
- [ ] Final launch statement is accurate and approved.

Decision: **HOLD** until every required checkbox has evidence and all approvals are recorded.

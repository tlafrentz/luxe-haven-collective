# GS-999A — Guidebook Studio v1 Launch Validation Storyboard

Status: **Release gate — not yet certified**  
Owners: Product, Engineering, QA, Customer Success, Operations  
Benchmark: `Luxe Haven Collective - Welcome Book - Mesa, AZ.pdf`

## Goal

Prove that Guidebook Studio supports the complete production customer lifecycle without direct database changes, seeded guidebook JSON, developer-only tools, or engineering intervention.

The validated lifecycle is:

Purchase → Dashboard → Property → Mesa Modern → Builder → Author → Preview → Publish → Guest → Revise → Publish V2 → Support → Operations

## Benchmark identity

| Attribute | Value |
|---|---|
| Source | `/Users/toddl/Downloads/Luxe Haven Collective - Welcome Book - Mesa, AZ.pdf` |
| Pages | 18 |
| Bytes | 31,355,292 |
| SHA-256 | `a7e1f78b061cc1169b0996fc5cf35ab5e16c21f409ae9088f07ed7be00a1774d` |
| Role | Official Mesa content, structure, tone, and output-quality benchmark |

The hash must be recorded with certification evidence so benchmark changes cannot occur silently.

## Evidence rules

Every validation below requires an artifact: trace, screenshot, immutable identifier, log query, accessibility result, recovery record, or signed operational approval. A working implementation without evidence is **not verified**. A skipped channel is **not passed**.

Production guidebook content must be created through customer-visible Guidebook Studio commands. Asset ingestion into the canonical Media Library and creation of reusable Content Library records are allowed. Direct guidebook inserts and developer-only mutation scripts are prohibited.

## Phase 1 — Customer acquisition

### Scenario 1: Purchase completes

Action: purchase Guidebook Studio and finish account creation.

Expected result:

- Customer identity and workspace are created once.
- Guidebook Studio entitlement becomes available.
- No HPM subscription is required.
- Dashboard shows “Ready to create your first guest experience.”
- Get Started opens `/dashboard/guidebooks/new`.

Required evidence: checkout identifier, entitlement projection, workspace identifier, dashboard screenshot, and redacted audit events.

### Scenario 2: Customer Dashboard

Action: sign in as the guidebook-only customer and open Guidebook Studio.

Expected result:

- Existing shell remains mounted.
- Guidebooks, drafts, published status, support entry, and permitted navigation load.
- Customer cannot access another workspace or HPM administration.

Required evidence: customer browser trace and negative authorization trace.

## Phase 2 — Guidebook creation

### Scenario 3: Canonical property

Execute both existing-property and new-property paths. For Mesa, create the production property through Add New Property.

Expected result:

- Required property fields validate accessibly.
- Duplicate address detection offers Use Existing or Create Anyway.
- One canonical manual property is created in the customer workspace.
- No guidebook-specific property copy exists.

Required evidence: UI trace, property identifier, workspace scope, duplicate-detection result, and audit event.

### Scenario 4: Mesa Modern draft

Action: select the published Mesa Modern template, enter guidebook details, and create.

Expected result:

- Exact template and template-version identifiers persist.
- Draft and starter sections are created atomically.
- Builder opens at `/dashboard/guidebooks/[id]/edit`.

Required evidence: guidebook/version/template identifiers, command receipt, audit event, and Builder screenshot.

## Phase 3 — Authoring

### Scenario 5: Recreate all Mesa content

Author these domains through the Builder: Welcome, Arrival, Wi-Fi, Rules, Appliances, FAQ, Safety, Emergency, Transportation, Things To Do, Restaurants, Nightlife, Shopping, Departure, Review, Social, and Thank You.

Required component evidence includes Hero, Rich Text, Wi-Fi Card, Rule Grid, FAQ Accordion, Recommendation Collection, Gallery, Departure Checklist, and Review CTA.

Expected result:

- Inline content persists through revision-aware commands.
- Reusable content is selected from canonical Content Library records.
- Images are selected from canonical Media Library assets and immutable versions.
- `{{wifi.network}}`, check-in time, and host phone resolve from canonical property values.
- Autosave and resume restore component order, bindings, media, visibility, and the active section.

Required evidence: authoring trace, component instance IDs, content/media binding IDs, save acknowledgements, and resume trace.

### Scenario 6: Responsive previews

Action: preview desktop, tablet, and mobile from the draft.

Expected result: Mesa Modern renders the same authored structure with resolved variables, optimized media, usable navigation, and no guest access to draft URLs.

Required evidence: three viewport screenshots and accessibility snapshots.

## Phase 4 — Publishing

### Scenario 7: Validation

Action: run publication validation, deliberately introduce one blocker, confirm publishing is disabled, fix it, and rerun.

Expected result:

- Content, media, variables, accessibility, and publishing checks are categorized.
- Errors block; warnings remain visible but do not block.
- No critical variable renders blank.

Required evidence: failing and passing validation captures plus validator result payloads.

### Scenario 8: Publish V1

Action: publish the passing draft.

Expected result:

- One atomic immutable snapshot is created.
- Responsive web, PDF, and QR artifacts derive from that snapshot.
- `/stay/luxe-haven-mesa` resolves only the active published snapshot.
- Partial channel failure does not activate a partial publication.

Required evidence: snapshot ID/hash, publication ID, channel artifact IDs/hashes, job timeline, and public route response.

## Phase 5 — Guest experience

### Scenario 9: Guest Portal

Action: open `/stay/luxe-haven-mesa` anonymously on desktop and mobile.

Expected result: hero, Wi-Fi, recommendations, FAQ, departure, review CTA, navigation, links, and images match the benchmark and expose no draft or sensitive administrative data.

Required evidence: anonymous browser traces, visual comparison, network errors, accessibility scan, and performance measurements.

### Scenario 10: QR

Action: download and scan the production QR artifact on a physical mobile device.

Expected result: QR opens the active `/stay/` destination quickly and records only approved analytics context.

Required evidence: QR artifact hash, physical-device scan recording, destination, and event receipt.

## Phase 6 — Continuous improvement

### Scenario 11: Revise after publication

Action: change one restaurant through the Builder after V1 is live.

Expected result: the draft changes and autosaves; V1 web/PDF/QR artifacts remain byte-for-byte unchanged.

Required evidence: before/after draft revisions and repeated V1 artifact hashes.

### Scenario 12: Publish V2

Action: validate and publish the updated draft.

Expected result: V2 becomes active, the guest sees the restaurant update, V1 remains immutable and queryable in history, and the public identity remains stable.

Required evidence: V2 snapshot/artifact hashes, public response, V1 history response, and audit trail.

## Phase 7 — Operations

### Scenario 13: Admin support

Action: an authorized administrator selects the Mesa customer workspace and opens its draft, publication history, and health context.

Expected result: admin actions stay in the customer workspace; unauthorized workspaces remain inaccessible; support can identify the active snapshot and failed jobs without engineering access.

### Scenario 14: Recovery

Execute documented media failure, publication failure, accidental archive/delete recovery, and deployment rollback exercises in staging before production approval.

Expected result: active guest delivery remains consistent, backups restore within declared targets, and republishing produces valid artifacts.

### Scenario 15: Platform health

Verify dashboards and alerts for draft save failures, publication failures, media processing/storage, QR generation, and guest-route availability. Trigger each alert safely in staging and retain notification evidence.

## Phase 8 — Launch decision

Launch may be certified only when GS-999B contains no unchecked required gate, no critical or major defect is open, the benchmark lifecycle has passed in production, and Product, Engineering, QA, Customer Success, Security, and Operations have signed the evidence package.

Final statement:

> Guidebook Studio v1 has successfully recreated the Luxe Haven Mesa guidebook using only the production application, and the complete lifecycle—from customer purchase through guest usage, updates, support, and operations—has been validated.

# Guidebook Studio

Guidebook Studio is the Guest Experience Publishing Platform. It produces
mobile-first guest websites, not PDFs or static house manuals. The v1 milestone
is `GB-001 — Guidebook Studio v1: Property Guidebook Creation, Publishing, and
Guest Delivery`.

Operators maintain one clear source of property information; guests receive the
right published guidance without needing an account.

Operators create one Guidebook per Property, organize guest-safe content into
sections and modular blocks, preview the current draft, and explicitly publish
immutable versions. A stable public URL resolves through an unguessable public
identifier to the active published version. Later draft edits never alter a
published snapshot.

The canonical lifecycle is:

`Draft → Published → Superseded → Archived`

`active_version_id` identifies the version currently served publicly.
Published versions are immutable. Restoring historical content copies it into
the mutable draft; making it public creates a new version rather than mutating
or reactivating the historical version. Archiving disables public delivery
without deleting drafts, versions, or retained analytics. Restoring an archived
Guidebook restores management access but requires explicit republication before
public delivery resumes.

Canonical routes:

- `/dashboard/guidebooks`
- `/dashboard/guidebooks/new`
- `/dashboard/guidebooks/[guidebookId]`
- `/dashboard/guidebooks/[guidebookId]/preview`
- `/dashboard/guidebooks/[guidebookId]/versions`
- `/dashboard/guidebooks/[guidebookId]/analytics`
- `/g/[publicId]`

The v1 content model supports Heading, Rich Text, Image, Instruction, Contact,
Location, Link, Callout, and Checklist blocks. The seeded section structure is
Welcome, Arrival, Parking, Property Access, Wi-Fi, House Rules, Amenities, Local
Recommendations, Checkout, Safety, and Contact. Operators may rename, reorder,
hide, add, duplicate, or remove draft sections. Templates remain an internal
administrative capability rather than primary owner navigation.

Creation, publishing, and hosting use the canonical `guidebooks.create`,
`guidebooks.publish`, and `guidebooks.host` entitlements. Guest Communications
consumes only a published Guidebook projection and public URL. V1 supports
copying or inserting that URL; automated messaging and booking-triggered
delivery are separate milestones.

Public pages contain only the active versioned guest-safe snapshot. Owner
identity, financial data, internal notes, administration fields, repository
identifiers, drafts, historical versions, and analytics are not included.
Anonymous engagement is sanitized, bounded, non-blocking, and must not imply a
verified guest identity.

## V1 Completion Gate

GB-001 is complete only when an authorized operator can create a Guidebook for
an eligible owned Property, persist and recover a draft, author every supported
block, preview with the public renderer, publish an immutable version, access it
anonymously by link or QR code, republish without changing history, restore
historical content through a new publication, review privacy-safe engagement,
and archive and restore safely.

Authorization must be proven for owner, different-owner, and anonymous
sessions. Publication must atomically advance `active_version_id`; failed or
repeated publication must not expose partial content or create uncontrolled
versions. Required tests, typecheck, repository lint, migration lint,
`git diff --check`, production build, responsive visual verification,
accessibility verification, applied migrations, and production
operator-to-guest verification are release gates.

## Creation Assistant

The Guidebook Creation Assistant is an optional creation path inside the
canonical Guidebook Studio. It is not a separate product, editor, content
model, renderer, or publication workflow. Dashboard customers and authorized
administrators use the same assistant and arrive in the same shared Builder.
Administrative creation on behalf of a customer retains the administrator as
the audited actor and never uses customer impersonation.

The creation entry point offers three choices:

1. **Auto-create with AI — Recommended.** Upload existing materials and create
   a first organized draft.
2. **Start from a template.** Choose an entitled, published, compatible
   template and complete its content manually.
3. **Start blank.** Create an empty draft and author it section by section.

All paths first establish an authorized property context: an existing HPM
property, an existing Guidebook-only property, or a new lightweight property.
All paths terminate in the shared revision-aware Builder.

### Assistant workflow

1. Select the authorized property context.
2. Upload source material. The MVP accepts PDF, DOCX, plain text, and supported
   property images. Incomplete inputs are permitted. Original files are
   immutable and retained according to the platform retention policy.
3. Review structured extraction before generation. The review groups property
   identity, arrival and parking, entry, Wi-Fi, rules, amenities, checkout,
   safety and emergency information, recommendations, photos, and missing
   information. Every extracted value displays its source and one status:
   `Confirmed`, `Needs review`, `Missing`, or `Conflicting`. Conflicts are never
   resolved silently.
4. Select an approved template, allowed branding, tone, included sections,
   recommendation policy, and publication language.
5. Start an asynchronous, idempotent, resumable generation run. The run
   organizes approved sections, uses only contract-ready components, improves
   clarity without changing operational meaning, associates photos with
   sections, records source lineage, and creates a saved draft revision.
6. Review the generated revision in the shared Builder. Generated sections
   show their AI status, source references, confidence, and unresolved fields.
   Users may edit normally, regenerate one section, or restore a prior
   generated revision.
7. Follow the existing review, approval, and publication lifecycle. Generation
   never submits, approves, schedules, or publishes a guidebook.

### Operational truth and high-risk confirmation

The assistant must not invent or automatically verify access instructions,
addresses, codes, policies, contact details, Wi-Fi credentials, amenities,
safety information, fees, or legal terms. The following values require explicit
human confirmation even when extraction confidence is high:

- property address;
- door, gate, alarm, and other access instructions or codes;
- Wi-Fi credentials;
- emergency contacts;
- parking restrictions;
- occupancy limits, quiet hours, pet rules, and checkout obligations;
- pool, spa, fireplace, and equipment instructions; and
- fees, penalties, and legal policies.

Access credentials should use protected or time-bounded guest data when that
capability is available instead of permanent public-guide content.

### Generation and governance rules

- Each run has a stable idempotency key, actor, tenant, property, source set,
  model/policy version, state, timestamps, and resulting draft revision.
- Duplicate submission returns the existing run and cannot create duplicate
  guidebooks or revisions.
- Extraction is per source. One failed file does not discard successful work
  from other files, and unsupported files produce actionable errors.
- Uploaded material, extracted facts, prompts, and generated content remain
  tenant-isolated and are excluded from product analytics and ordinary logs.
- Customer content must not be used for model training.
- Generation may use only templates published for use and component versions
  whose contract, schema, editor, renderer, preview renderer, bindings,
  authorization, and compatibility checks are complete.
- Missing compatibility fails closed. Customer-facing experiences never expose
  contract, schema, renderer, or migration terminology. Component remediation
  remains in the administrator-only governance workflow.
- Source files and generated revisions are recoverable; published revisions
  remain immutable.
- Section regeneration creates a traceable new draft revision and cannot
  rewrite unrelated sections.

### Role policy

Customers and authorized administrators may upload sources, review extraction,
generate a draft, view source/confidence, edit generated content, and regenerate
a section. Customers cannot approve component mappings or override blocking
safety findings. Administrators may govern component mappings and perform only
explicitly authorized, reasoned overrides. Publication remains entitlement- and
role-dependent for both paths.

### MVP and deferrals

The first production release includes PDF, DOCX, text, and image uploads;
structured extraction; photo organization; one approved template; approved core
components; missing/conflicting-content review; draft generation; shared Builder
handoff; section regeneration; and mandatory human review.

Arbitrary listing-page scraping, generated local recommendations, multilingual
generation, automatic photo enhancement, simultaneous design alternatives,
full-property knowledge synchronization, and one-click publishing are deferred.

### Creation Assistant release gate

The assistant is unavailable in production until evidence proves tenant and
property authorization for every read and mutation, private storage boundaries,
idempotent duplicate handling, resumable jobs, partial extraction failure,
conflict preservation, high-risk confirmation, approved-component filtering,
source lineage, generated-revision recovery, section-scoped regeneration,
Builder renderer parity, audit history, and a human-only publication boundary.
Unknown or untested behavior fails this gate.

Product principle: **AI creates the first organized draft; the customer remains
responsible for confirming operational truth.**

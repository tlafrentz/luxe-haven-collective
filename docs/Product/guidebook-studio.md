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

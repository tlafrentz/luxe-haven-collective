# Guidebook Studio

Guidebook Studio is the Guest Experience Publishing Platform. It produces mobile-first guest websites, not PDFs or static house manuals.

Operators create one Guidebook per Property, organize guest-safe content into sections and modular blocks, preview the current draft, and explicitly publish immutable versions. The current public URL points to the selected published version; later draft edits never alter that snapshot.

Canonical routes:

- `/dashboard/guidebooks`
- `/dashboard/guidebooks/new`
- `/dashboard/guidebooks/[guidebookId]`
- `/dashboard/guidebooks/[guidebookId]/preview`
- `/g/[publicSlug]`

The initial content model supports headings, rich text, images, galleries, videos, maps, callouts, checklists, contacts, buttons, links, and dividers. Initial recommendations cover restaurants, coffee, bars, groceries, pharmacy, hospitals, activities, shopping, and transportation.

Creation, publishing, and hosting use the canonical `guidebooks.create`, `guidebooks.publish`, and `guidebooks.host` entitlements. Guest Communications consumes only a published Guidebook projection and public URL.

Public pages contain only the versioned guest-safe snapshot. Owner identity, financial data, internal notes, administration fields, and repository identifiers are not included.

# QA Review — marketing — 2026-08-03

## Scope
- Routes reviewed: 12 of 15 (`node .claude/skills/qa-review/scripts/discover-routes.mjs --area=marketing`)
- Routes skipped: 3 — see below
- Commit reviewed: fd002c0c

## Summary
Critical: 0 · High: 1 · Medium: 4 · Low: 2

## Findings

### Global (root layout) — affects `/notary`, `/stays/[slug]`, and others outside this area
**[High] [Technical]** Page `<title>` shows the brand name twice on every page that sets its own title
- What: The browser tab title reads `"Texas Mobile Notary Services | Luxe Haven Collective | Luxe Haven Collective"` on `/notary`, and `"Stylish 2BR Retreat Sleeps 4 • Near Downtown Mesa | Luxe Haven Collective | Luxe Haven Collective"` on `/stays/mesa-downtown-retreat` — the brand suffix is duplicated.
- Evidence: `src/app/layout.tsx:10-13` defines a title template (`template: "%s | Luxe Haven Collective"`), which Next.js applies to any page-level `title`. But `src/app/(marketing)/notary/page.tsx:6` sets `title: "Texas Mobile Notary Services | Luxe Haven Collective"` — already including the suffix — so the template appends it a second time. Same pattern in `src/app/(marketing)/stays/[slug]/page.tsx:24-26` (`` `${property.name} | Luxe Haven Collective` ``).
- Why it matters: every affected browser tab, bookmark, and search-result title looks broken/duplicated — a visible, easy-to-notice polish bug on public-facing pages.
- Suggested fix: drop the `" | Luxe Haven Collective"` suffix from each page's own title string and let the root template add it once. This also affects `(auth)/login`, `(auth)/register`, `(auth)/forgot-password`, `(auth)/update-password`, `(public)/g/[publicSlug]`, and `(public)/shared/investment-report/[shareId]/[secret]` — see the auth and public reports.

### Most marketing pages (`/about`, `/services`, `/owners`, `/contact`, `/faq`, `/resources`, `/lead-magnet`, `/stays`, `/store`, `/store/[slug]`)
**[Medium] [Content]** No page-specific `<title>` — every one of these pages shows the generic homepage title in the browser tab
- What: Confirmed live (tab title stayed `"Luxe Haven Collective | Boutique Short-Term Rental Hospitality"` on `/about`, `/services`, and others) and via source: only `notary/page.tsx` and `stays/[slug]/page.tsx` export `metadata`/`generateMetadata` among the marketing routes; `about`, `services`, `owners`, `contact`, `faq`, `resources`, `lead-magnet`, `stays` (listing), and `store` (listing + `[slug]` detail) do not.
- Why it matters: every tab looks identical when multiple pages are open, bookmarks are indistinguishable, and search engines get the same title/snippet for every page — real SEO impact for a marketing site.
- Suggested fix: add `export const metadata` (or `generateMetadata` for `store/[slug]`) to each of these page files, following the pattern already used correctly elsewhere in the codebase (once the double-suffix bug above is fixed).

### `/` (homepage) → `metadataBase` fallback
**[Medium] [Technical]** Open Graph / canonical URLs fall back to the wrong domain
- What: `src/app/layout.tsx:9` sets `metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://luxehavencollective.com")` — but the real production domain is `luxehavencollective.co` (no "m"), per `README.md:7` and `docs/environment-reference.md:52`. `NEXT_PUBLIC_SITE_URL` is not set in this project's own `.env.local`.
- Evidence: `grep NEXT_PUBLIC_SITE_URL .env.local` returns nothing; README and docs consistently reference `.co`.
- Why it matters: in any environment where `NEXT_PUBLIC_SITE_URL` isn't explicitly set, Open Graph images, canonical links, and absolute metadata URLs resolve to `luxehavencollective.com` — a domain this project doesn't appear to control — instead of the real `.co` domain. That breaks social-share previews and canonical SEO signals silently (no error, just wrong URLs).
- Suggested fix: change the fallback in `src/app/layout.tsx:9` to `https://luxehavencollective.co`, and confirm `NEXT_PUBLIC_SITE_URL` is actually set in the Vercel production/preview environment (not verifiable from this local checkout).

### `/faq`
**[Medium] [Content]** Internal jargon and possibly stale claims in customer-facing copy
- What: The FAQ answer to "Is there an owner portal?" says *"The Sprint 2 foundation includes an owner portal shell..."* — "Sprint 2" is internal dev-process language that shouldn't appear in public copy. Separately, "Can guests book directly?" answers that "the booking engine, payments, and availability logic are planned for the next product milestones," but the app already has a working `/checkout` flow, a `/store` product catalog, and `/admin/commerce` — this FAQ answer may now be stale/inaccurate about what's actually shipped.
- Evidence: page text captured live from `/faq`.
- Why it matters: "Sprint 2" reads as an editing mistake to any visitor, and undersells (or misdescribes) real product capability if the booking/payments claim is now out of date.
- Suggested fix: rewrite that answer without internal sprint references, and confirm with product whether the direct-booking/payments claim still holds now that checkout exists.

### `/resources`
**[Medium] [Functionality]** Two of three "resource" cards don't lead to a resource
- What: The page lists three resource cards, each with an "Explore →" link. Only "Owner Revenue Checklist" goes where it implies (`/lead-magnet`, the actual checklist download). "Guest Experience Audit" links to `/contact`, and "Listing Optimization Guide" links to `/services` — neither is a guide/audit, they're a contact form and the services page.
- Evidence: `read_page` on `/resources` — `href="/lead-magnet"`, `href="/contact"`, `href="/services"` respectively.
- Why it matters: a visitor clicking "Explore →" on a promised guide lands somewhere unrelated to what was promised — a real expectation/functionality mismatch, not just a nitpick.
- Suggested fix: either build the two missing resource pages, or change the card copy/CTA so it accurately describes where the link goes (e.g., "Talk to us about your guest experience" instead of implying a downloadable audit).

### `/resources/str-revenue-readiness-checklist`
**[Low] [Content]** Orphaned page — not linked from anywhere in the app
- What: This page exists, renders correctly, and has real content, but nothing in the app links to it (`grep -rl str-revenue-readiness-checklist src/` only finds it referenced by slug in email-template/form-handling code, not in any `<Link>`/`href`). It's only reachable by typing the URL directly.
- Why it matters: content that was built but never surfaced — either dead weight or a missed opportunity to link it from `/resources` (which currently sends "Explore →" traffic elsewhere, see above).
- Suggested fix: link this page from the `/resources` listing, or confirm it's intentionally unlisted (e.g., only shared via the lead-magnet email) and document that.

### `/` (homepage), dark mode
**[Low] [Accessibility]** Dark mode is only partially applied
- What: With `prefers-color-scheme: dark`, the header switches to a dark background correctly, but the hero section and rest of the page body stay in the same light cream color scheme as light mode — producing a jarring half-dark/half-light page rather than a consistent dark theme.
- Evidence: screenshot captured at desktop size with `colorScheme: dark`.
- Why it matters: inconsistent, unfinished-looking dark mode is worse than no dark mode — it signals the theme wasn't tested. Likely because the marketing site predates or doesn't reuse `src/design-system/tokens/tokens.ts`'s dark palette that other parts of the app (header/shell) draw from.
- Suggested fix: either give the marketing site a real dark treatment using the existing design tokens, or scope `dark:` styling off for the marketing route group entirely so it stays consistently light rather than half-applying.

## Cross-page patterns
- The title-duplication bug and the missing-page-metadata gap are the two most impactful findings — both are one-line-per-file fixes but touch nearly every marketing route's SEO/tab-title quality.
- No client-side API calls were observed on any marketing page (`read_network_requests` showed only Next.js dev-server/static asset traffic) — this site is fully server-rendered, so there's no network-level inefficiency to report here; if there's a performance concern it would be in server-side data fetching, and nothing observed during this pass looked slow or duplicated.
- No console errors on any page visited.

## Routes skipped
- `/checkout/[checkoutSessionId]` — dynamic route requires a real checkout session ID, which only exists after completing a checkout flow. Not fabricated; completing checkout to get one would create a real record, which is out of scope for this review.
- `/stays/[slug]` (`/stays/mesa-downtown-retreat`) — reviewed earlier this session (before this report), confirmed working with no console errors; not re-walked here to avoid duplicate work. See the title-duplication finding above, which was found on this route.
- Contact form (`/contact`) and lead-magnet form (`/lead-magnet`) submissions were not tested — both trigger real Resend email notifications; only the page rendering and field presence were checked, not a real submit.

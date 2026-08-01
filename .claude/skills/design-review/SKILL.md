---
name: design-review
description: Reviews UI work in this app — mockups, screenshots, or a live page/component — against this project's design system (src/design-system tokens, src/components/primitives and patterns), and checks that it actually works: links go where they claim, buttons and state changes do what they say, and the copy reads clearly. Use this whenever the user asks to review a page or component for design or quality, shares a screenshot of the UI, asks "does this look right," wants UX/visual feedback, or has just finished building or changing any UI, even if they don't say "design review" explicitly. Also use it proactively after implementing a new page, form, or component before considering the work done.
---

# Design Review

This project has a real design system, not just ad-hoc Tailwind classes: `src/design-system/tokens/tokens.ts` defines the color palette (light and dark), typography scale, spacing, radius, elevation, motion, and sizing values that the rest of the app is supposed to draw from. `src/components/primitives` (Button, Badge, IconButton, Progress, TextField) and `src/components/patterns` (Card and friends) are the reusable building blocks. A design review here isn't generic taste — it's checking whether new UI work is actually drawing from that system or quietly drifting from it.

## Step 1: Get eyes on the actual UI — and use it, don't just look at it

Before reviewing anything, read `src/design-system/tokens/tokens.ts` fresh (don't rely on memory of past values — it may have changed) and skim `src/components/primitives/index.ts` and `src/components/patterns/index.ts` for the current list of reusable components. This is your ground truth for the review.

Then get the actual visual artifact:

- **Screenshot or image provided** — use it directly. This limits you to a visual review (see Step 2) since there's nothing to click.
- **File path, URL, or component name given** — open it.
- **Nothing attached** — don't ask the user to go take a screenshot; drive the Browser tool yourself. Start the dev server if it isn't running, navigate to the relevant page, and capture it. Since this design system explicitly defines both light and dark palettes, check both color schemes rather than assuming light mode is representative — dark mode is where token-drift bugs hide (a hardcoded `#171412` looks fine in light mode and wrong in dark). Also check at least a mobile width and a desktop width using `resize_window` — the token file defines a `touchTarget: 44px` size specifically for mobile tap targets, so mobile is often where real issues surface, not just an afterthought.

If you have a live page in front of you (not just a static screenshot), actually interact with it — click the primary buttons, follow the links, submit the forms, switch between the states a user would switch between. A screenshot only shows you what one state of the page looks like; most real bugs live in the transition between states, and you will not find them by staring at a still image. When you resize the viewport or navigate, wait for the layout to actually settle before screenshotting — a page mid-transition can look broken in a screenshot even when the real, settled state is fine, and reporting that as a bug erodes trust in the whole review. If something looks wrong, reproduce it a second time before writing it up.

Stay within what's safe to do without the user in the loop: don't log in with credentials, don't trigger anything that looks irreversible (a "Start over" or "Delete" button on real data), and don't submit forms with fabricated data that might actually persist. If a flow needs auth or a destructive action to see past it, say so and ask rather than guessing.

## Step 2: What to actually look for

Work through these categories. Not every review needs all of them — a single-component review doesn't need a responsive-grid check — use judgment about what's relevant to what changed.

**Token consistency.** Look for hardcoded values that duplicate what a token already expresses: a raw hex color instead of `designSystemTokens.color.*`, a `px` spacing value that doesn't land on the 4px/8px scale in `tokens.spacing`, a border-radius that doesn't match `tokens.radius`, a shadow that isn't one of `tokens.elevation`. The point isn't "tokens good, literals bad" as a rule to enforce blindly — it's that unmatched values usually mean the new UI will look subtly inconsistent next to everything else, and will silently break if the token values ever change.

**Component reuse.** If the UI reinvents something a primitive or pattern already provides — a custom button, a hand-rolled badge/pill, a card-like container built from scratch — flag it and name the existing component it should probably use instead. Read the actual primitive's source before suggesting it, so the suggestion accounts for its real props rather than a guess.

**Dark mode.** Since this system ships a real dark palette, treat "does it work in dark mode" as a first-class check, not a nice-to-have: text contrast against `surfaceCanvas`/`surfaceRaised`, borders that vanish, icons that don't have a dark variant.

**Accessibility basics.** Contrast between text and background tokens, visible focus state (there's a dedicated `borderFocus` token — if focus is invisible, that's a real bug, not a nitpick), touch target size on mobile, and icon-only controls without an accessible label.

**Responsive layout.** Cramped spacing, overflow, or broken alignment at the viewport sizes you captured.

**Overall polish and consistency.** Spacing rhythm, visual hierarchy, whether it reads as part of the same product as the rest of the app.

**Verbiage and copy.** Read the actual text like a user would, not just as UI chrome: does it make sense, is the terminology consistent (the same object shouldn't get a different name every time it's mentioned), is the tone consistent with the rest of the app, any typos. This is easy to skip because it's not "design" in the visual sense, but confusing copy undermines a UI just as much as a broken layout does.

**Functional correctness.** This is only possible when you're driving a live page (see Step 1) — click the buttons and links, check that navigation goes where it claims to, that state-changing controls (toggles, selects, confirmation dialogs) actually produce the effect their label promises, and that anything advertised as protecting the user (a "you'll lose your work" warning, a disabled state) actually fires when it's supposed to. Where visual findings are about drift from the design system, functional findings are usually about a mismatch between what the UI *says* it will do and what the code actually does when you trace it — so when something behaves unexpectedly, don't stop at "this seems off," follow it into the source and cite the specific line responsible. That's what makes the difference between a vague impression and a finding someone can act on.

## Step 3: Report findings

Group findings so someone can scan them fast — by severity (broken/inaccessible first, polish nits last) reads better than a flat list. For each finding, say what's wrong, why it matters (not just "inconsistent" — what will actually go wrong for a user or the next person touching this code), and what to do instead, citing the specific token, component, or file:line involved. Skip findings you're not confident about rather than padding the list — a review full of nitpicks trains people to stop reading it.

## Step 4: Offer to fix

After presenting findings, ask whether to apply the fixes. If yes, make the edits (swap in the token or component, fix the contrast issue, etc.), then re-capture the screenshot to confirm the fix actually looks right rather than just trusting the diff — a token swap can still look wrong if it was the wrong token.

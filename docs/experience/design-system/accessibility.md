# Accessibility

**Target:** WCAG 2.2 Level AA  
**Applies to:** every shared component and product template

Accessibility is an implementation requirement, not a final visual review.

## Required behavior

- Use semantic landmarks, headings, tables, labels, and native controls.
- Provide complete keyboard operation, visible focus, logical order, and skip navigation.
- Meet contrast requirements in light, dark, disabled, focus, and status states.
- Never communicate status, series, or required action through color alone.
- Associate help and validation text with its field; announce asynchronous errors and completion when appropriate.
- Trap focus in modal dialogs, restore it when dialogs and drawers close, and expose expanded state.
- Respect reduced-motion and system appearance preferences.
- Support text resizing and 200% zoom without loss of task completion.
- Give icon-only actions accessible names and interactive controls a minimum 44-by-44 CSS-pixel target.
- Supply text summaries or data tables for decision-relevant charts.
- Preserve table headers, captions, row relationships, and sortable-state announcements.

## Component acceptance

Each shared component documents keyboard behavior, accessible name and relationships, focus behavior, state announcements, contrast, touch targets, and reduced-motion behavior. Automated checks supplement—never replace—keyboard and screen-reader review.

## Template acceptance

Each product template validates landmark order, one H1, navigation orientation, responsive reading order, error recovery, focus after route or step changes, and access to critical information without a pointer.

Critical patterns—including navigation, forms, dialogs, master-detail workspaces, data tables, and AI assistance—receive screen-reader review before release.

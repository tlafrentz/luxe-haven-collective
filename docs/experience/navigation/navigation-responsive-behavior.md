# Navigation Responsive Behavior

## Desktop

At 1024px and above:

- persistent left sidebar;
- full labels by default;
- current workspace shown near the brand;
- HPM lifecycle visible and expanded;
- Business and Services visible;
- active ancestors emphasized;
- user controls anchored after the independently scrolling navigation.

The sidebar may collapse to product icons. Collapsed mode retains brand identifier, active state, product tooltips, badge indicators when present, workspace context access, and user menu. Concept-only group labels disappear; grouped spacing and active ancestry keep products interpretable.

## Tablet

From 768px through 1023px:

- sidebar becomes a temporary drawer;
- application header retains the current product;
- drawer shows full hierarchy rather than an icon rail;
- active groups are expanded;
- destination selection closes the drawer;
- Escape and overlay selection close it;
- closing restores focus to the menu trigger.

Tablet never relies on icon-only navigation as the sole product selector.

## Mobile

Below 768px, use a drawer or full-screen panel:

```text
Menu        Current product        Context/actions
```

The panel preserves group labels, indentation, active state, accessible badges, current workspace, and user controls. Product names wrap rather than truncate where practical. Targets meet a 44px minimum. Deep product navigation remains inside the product as scrollable tabs, selectors, steps, or record lists.

Mobile does not expose the whole hierarchy in a narrow persistent icon rail.

## Scroll and reachability

Navigation and content scroll independently. On short viewports, no combination of sticky brand, switcher, and user controls may make the active product unreachable. User controls may follow the navigation region rather than consume excessive fixed height.

## Drawer accessibility

- `role="dialog"` and modal semantics
- accessible drawer name
- focus placed within the open drawer
- complete keyboard traversal
- Escape dismissal
- body-scroll lock
- trigger `aria-expanded`
- focus restoration after close
- reduced-motion transitions

## Permission and route change

If permission is revoked while active, protected commands stop immediately. The app redirects to the nearest valid product—normally Home—and explains that access changed. The navigation drawer must not retain or reveal the removed destination.

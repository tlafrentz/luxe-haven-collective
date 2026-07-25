# Navigation Permissions and Visibility

## Principle

Navigation is a capability-filtered projection, not a security boundary. Server route guards, application commands, repositories, and data policies remain authoritative.

## Visibility states

### Available

The user has the required capabilities and the product is released. The item is routable.

### Available, setup required

The user may enter the product, but required customer configuration is missing. Keep the product visible and communicate the requirement inside the product. A navigation attention badge is allowed only when it helps prioritize action.

### Restricted

If the user can never access a product under the current role, omit it. Discoverable locked paid capability requires explicit product strategy and is not the default.

### Feature flagged

Hide from general users. Preview participants receive the item only when both capability and feature flag resolve. A feature flag never grants authorization.

### Administrative

Internal Operations Console products require internal capabilities and never appear as customer products. An authorized user may receive one separated Administration utility link that opens the Operations Console; its internal destinations are resolved only inside that experience. Customer Workspace management capabilities do not grant provider monitoring or internal customer administration.

## Typed resolution

Each item may declare:

- `requiredCapabilities`
- `featureFlag`
- `availability`
- `setupRequirement`

Resolution first filters products by capability and feature participation, then includes only the ancestor groups required to explain visible descendants. Empty conceptual groups do not appear.

## Setup and degradation

No workspace configured:

- show Home and Workspace;
- guide setup;
- suppress dependent products when no meaningful first-use experience exists.

No connected source:

- products may stay visible;
- show setup-required state inside the product;
- do not create false empty dashboards.

Integration failure:

- keep affected products visible;
- optionally show actionable attention;
- explain available and unavailable capability inside the product.

## Revocation

When access changes during a session:

1. deny further protected operations;
2. discard protected navigation projections;
3. redirect to the nearest safe product;
4. explain the access change without exposing protected record details.

## Administration boundary

| Customer Workspace | Internal Operations Console |
|---|---|
| Organization and team | Customer-account operations |
| Customer property access | Internal property intervention |
| Connected-system intent | Provider monitoring and repair |
| Notifications and preferences | Platform configuration |
| Guidebook Studio | Guidebook Projects fulfillment |

Hiding Administration is not sufficient; `/admin` routes and all internal commands require server-authoritative internal capabilities.

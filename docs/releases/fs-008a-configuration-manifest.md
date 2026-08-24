# FS-008A Furnishing Configuration Manifest

Values are intentionally excluded. Missing, malformed, or contradictory values resolve to the safe disabled state.

| Variable / control | Purpose | Environments | Secret | Presence | Safe default | Invalid/missing behavior | Owner |
|---|---|---|---|---|---|---|---|
| `FS008_FURNISHING_GLOBAL_STATE` | Global release state | local, preview, production | No | migration-backed | `disabled` | deny all activation | Release Engineering |
| `FS008_FURNISHING_GLOBAL_KILL_SWITCH` | Immediate stop | local, preview, production | No | migration-backed | `true` | deny all activation | SRE |
| `FS008_FURNISHING_POLICY_VERSION` | Policy version pin | local, preview, production | No | migration-backed | `fs008a-v1` | configuration_invalid | Engineering |
| `FS008_FURNISHING_CHECKOUT_ENABLED` | Checkout capability | local, preview, production | No | not enabled | `false` | deny checkout | Commerce |
| `FS008_FURNISHING_ENTITLEMENT_ENABLED` | Entitlement capability | local, preview, production | No | `false` | deny grant/reactivation | Commerce |
| `FS008_FURNISHING_PROJECT_CREATION_ENABLED` | Project creation capability | local, preview, production | No | `false` | deny creation | Furnishing |
| `FS008_FURNISHING_CATALOG_PUBLICATION_ENABLED` | Customer-visible catalog | local, preview, production | No | `false` | deny publication/import activation | Catalog |
| `FS008_FURNISHING_NOTIFICATIONS_ENABLED` | Customer notification dispatch | local, preview, production | No | `false` | suppress dispatch, record denial | Support Operations |
| `FS008_FURNISHING_RETAILER_ORDERING_ENABLED` | Retailer purchase/provider dispatch | local, preview, production | No | `false` | deny before provider call | Procurement |

No secret values are stored in this manifest, client bundles, logs, or evidence.

# Commerce Architecture

Commerce is isolated under `src/platform/commerce`.

```text
Catalog -> Product -> Offer -> Versioned Price -> future Checkout
                    -> Entitlement Template
                    -> Fulfillment Template
Customer -> Pending Order -> Immutable Order-Line Snapshots
```

Provider identifiers are optional adapter references. The domain and consuming features remain provider-neutral. Order lines copy product and price snapshots so future catalog changes cannot rewrite commercial history.

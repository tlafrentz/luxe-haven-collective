# Checkout Flow

```text
Offer ID from browser
  -> authenticated server action
  -> canonical Offer/Product/Price resolution
  -> Commerce Customer resolution
  -> persisted Pending Order and immutable lines
  -> Stripe Checkout Session
  -> persisted Checkout context
  -> hosted Stripe redirect
  -> pending success or cancellation page
```

The browser never submits amount, currency, provider price, workspace authority, entitlements, or fulfillment. Success remains pending until a future signed webhook confirms payment.

# Commerce Domain

Commerce is the canonical source of commercial truth for Luxe Haven Collective. It defines products, offers, versioned prices, eligibility, customers, pending orders, entitlements, and fulfillment contracts without processing payments.

Public catalog routes are `/products`, `/products/[slug]`, and `/pricing`. Administration begins at `/admin/commerce`.

Products define what is sold. Offers bundle and position products. Prices define how products are sold. Features request entitlements or fulfillment through Commerce application services and never reference Stripe identifiers.

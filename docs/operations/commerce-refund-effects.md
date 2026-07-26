# Commerce Refund Effects

Refund behavior is configured per entitlement rule: retain, suspend, revoke, or manual review. Completed professional work, consumed credits, digital downloads, and in-progress projects default to manual review.

Refund processing never deletes feature data or rewrites Payment history. Reversal commands are idempotent and append entitlement history. PC-001C.5 creates a manual-review fulfillment when no safe automatic reversal is configured.

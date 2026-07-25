# Product Health Pattern

## Principle

Health is a bounded, product-specific explanation of current condition—not a universal Luxe Haven score.

Every health indicator has:

1. **Status**
2. **Supporting evidence**
3. **Interpretation**
4. **Recommended action**, when intervention is possible

A color, icon, percentage, or label without evidence and meaning is insufficient.

## Allowed dimensions

- Completeness
- Freshness
- Connectivity
- Risk
- Attention
- Performance
- Reliability
- Delivery status

A product selects only dimensions that influence its primary business question.

## Status vocabulary

| Status | Meaning |
|---|---|
| Healthy | Within the product’s stated operating policy |
| Attention | Customer action is recommended |
| Degraded | Partial capability or confidence is unavailable |
| Inactive | Not configured, scheduled, or intentionally disabled |

Critical urgency may be represented above the overview when immediate harm or guest impact is plausible.

## Evidence requirements

Evidence names the observation and freshness:

```text
Connected Systems
Attention
Hospitable has not completed a sync in 18 hours.
Reservation changes may not appear in operational products.
Review connection
```

Do not imply real-time freshness when the source is a snapshot. Retain source and evaluated-at lineage in the read model even when the interface uses concise text.

## Stable product models

| Product | Model | Core dimensions |
|---|---|---|
| Workspace | Configuration | Completeness, connectivity |
| Guest Communications | Work queue | Attention, waiting, urgency |
| Reports | Publishing | Delivery, freshness, drafts |
| Guidebook Studio | Completion | Completeness, publication, reach |
| Revenue Intelligence | Performance | Performance, freshness, opportunity |
| Action Center | Work queue | Attention, execution, blocked state |
| Learning Intelligence | Reliability | Evidence coverage, effectiveness, freshness |

Do not change health models merely to accommodate an attractive new metric.

## Implementation

`HealthSummary` groups three to six `HealthIndicator` components. Domain code owns status derivation and wording. The component requires evidence and interpretation at the type boundary, making decorative status-only cards harder to introduce.

## Review questions

- Does this status answer the product’s business question?
- Is the evidence trustworthy and fresh?
- Can the user understand the consequence?
- Is the recommended action owned by this product?
- Would removing the indicator change a decision? If not, remove it.

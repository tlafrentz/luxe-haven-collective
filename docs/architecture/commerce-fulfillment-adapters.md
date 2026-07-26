# Commerce Fulfillment Adapters

Adapters receive canonical Commerce identity, scope, immutable Product configuration, and an idempotency key. They return a stable target type, target ID, state, and next action.

Supported keys are entitlement-grant, digital-download, guidebook-project, investment-analysis-credit, notary-service-request, manual-service-order, and no-op. Feature-specific validation stays behind bounded ports.

If a call times out after possible creation, the process manager resolves by idempotency key before retrying creation. Cross-workspace targets fail closed.

# Platform Actions (PF-009)

This capability is the canonical model for operational Actions. It owns action
identity, status, priority, ownership, type, outcome, collections, lifecycle
transitions, policy construction, and policy execution.

Feature code defines action types and policies. The platform model deliberately
does not know about properties, hospitality, dashboards, or Action Center.

During migration, `features/execution-engine` keeps `ExecutiveAction` as a
legacy serialization/view DTO because Action Center expects string IDs, ISO date
strings, and property/priority provenance. Its adapter converts that DTO to the
canonical `Action`; shared primitives are temporary re-exports from this package.
The DTO is not a second domain entity and new domain behavior belongs here.

One semantic mismatch is intentional: policy-created Actions require at least
one source Decision, while manually created or legacy Actions may have no
Decision provenance.

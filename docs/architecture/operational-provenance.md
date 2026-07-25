# Operational Provenance

Operational provenance connects provider observations to canonical values without moving provider logic into products.

## Source types

- Provider sourced
- User sourced
- Platform derived
- System defaulted

Field-level provenance may retain workspace, canonical record, provider, external reference, observed time, ingestion time, mapping version, canonical policy version, and an optional user override reference.

Raw provider payloads stay in restricted integration persistence. Customer projections use friendly source labels. Broad summaries omit provider references and guest personal information.

## Relationship to Platform Observations

Platform Observations remain the source-fact vocabulary. Operational provenance records the ingestion and transformation lineage required for synchronization diagnosis and quality evaluation. Quality policies assess fitness; Observations do not carry an implicit quality score.

## Conflict policy

A material conflict retains the chosen observation and rejected observations. Resolution identifies the source authority, observation time, policy, reason, and policy version. User overrides take precedence only where the field policy permits.

## Diagnostics

Structured diagnostics may contain workspace ID, connection ID, sync run ID, canonical record ID, issue code, mapping version, policy version, and timestamp. They exclude raw payloads, names, email, phone, credentials, and message content.

# IA-002A.7.3 — Commercial Persistence

Commercial persistence extends the core pipeline bundle with normalized offer, counterparty-response, agreement-basis, and contract rows. Route-specific commercial terms remain discriminated JSON snapshots; the route discriminator is persisted and validated before domain restoration.

The repository loads offers by sequence, responses by response time, and contracts by recorded time with stable ID tie-breakers supplied by the gateway. It maps those rows into immutable domain values and invokes `AcquisitionPipeline.restore()` as the final validity gate.

Submitted commercial facts are protected by a database trigger against term, route, source-analysis, and sequence mutation. Draft edits remain governed by aggregate behavior. Counterparty responses are separate records and never overwrite submitted offer terms. Agreement basis stores accepted offer/counteroffer lineage independently from the final contract.

Commercial writes are included in the repository’s core save bundle and therefore participate in the same pipeline version boundary. The Supabase gateway is responsible for inserting new commercial rows, appending responses, and atomically updating the pipeline bundle in the transaction boundary introduced by IA-002A.7.1.

Contingencies, due diligence, closing facts, Action/Evidence references, and Property onboarding remain deferred to later persistence milestones.

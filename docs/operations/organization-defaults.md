# Organization defaults operations

Organization defaults are fallbacks:

1. an explicit property override wins where the product supports one;
2. an applicable user preference controls personal presentation;
3. the confirmed organization value supplies the workspace fallback;
4. a documented platform default prevents a missing value from breaking first
   use.

Sprint 4B platform defaults are `America/Chicago`, `USD`, `en-US`, and `US`.
They are stored for safe operation but do not count as confirmed configuration.

Timezones must be IANA identifiers rather than fixed UTC offsets. Currency uses
ISO 4217, country uses two-letter country codes, and language uses a stable BCP
47-style code.

Legacy invalid regional values remain readable during migration because the
new constraints are installed `NOT VALID`; new writes must satisfy them. The
Organization page presents a degraded correction state without discarding
other fields.

Concurrency failures require the operator to refresh and review current data.
Repeating the same command ID and payload is safe. Reusing a command ID with
different input is rejected.

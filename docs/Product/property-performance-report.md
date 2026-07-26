# Property Performance Report

The Property Performance Report requires one authorized Property, a reporting period, and a canonical Property report projection. It describes measured performance, comparisons, revenue drivers, operational attention, recommendations, actions, evidence, and freshness without guest-identifying information.

Generation must fail with `report_source_not_ready` when the feature-owned Property projection port is unavailable. Reporting must not query reservations or Property tables as a fallback.

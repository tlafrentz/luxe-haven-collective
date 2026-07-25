# Portfolio Property Comparison Projection

`PortfolioPropertyComparison` derives from current and optional comparison
PI-001A projections after Workspace authorization and inclusion resolution.

The application boundary separately models performance, change, contribution,
efficiency, operational burden, evidence, and role. Capability filtering happens
before the read model is returned: restricted users receive neither financial
fields nor financial ranking order.

The cache key includes Workspace, membership, role, authorized and included
property sets, periods, comparison, metric family, normalization, grouping,
capabilities, and projection version. Workspace invalidation removes every
variant.

Portfolio Overview calls the PI-001C comparison builder for its contribution
preview. Executive Intelligence may consume bounded summaries only.

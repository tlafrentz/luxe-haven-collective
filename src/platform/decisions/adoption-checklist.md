# Adoption Checklist

- Inventory existing decision models
- Preserve public enums
- Replace primitive fields with DecisionContext
- Replace explanation strings with DecisionRationale
- Wrap final result in Decision<TOutcome>
- Add adapter where compatibility is required
- Remove adapter only after all callers migrate
